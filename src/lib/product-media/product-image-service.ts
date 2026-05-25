import {
  ALLOWED_PRODUCT_IMAGE_MIME_TYPE_SET,
  MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES,
  MAX_PRODUCT_IMAGE_FILES,
} from './constants';
import {
  getFileExtensionFromName,
  getOriginalObjectKey,
  getPublicStorageUrl,
  getStorageObjectKey,
  getStorageObjectKeysWithVariants,
  isStagedProductImageObjectKey,
} from './storage-keys';
import {
  assertStorageObjectsExist,
  deleteProductImageFilesByObjectKeys,
  deleteStorageObjectKeysBestEffort,
  deleteStorageObjects,
  downloadStorageObject,
  uploadStorageBuffer,
  uploadStorageObject,
} from './supabase-storage';
import {
  getContentTypeFromExtension,
  uploadOptimizedImageVariants,
  uploadOptimizedImageVariantsFromBuffer,
} from './image-processing';

type IncomingImageFile = {
  clientId: string;
  file: File;
};

type IncomingUploadedImage = {
  clientId: string;
  fileName: string;
  objectKey: string;
};

export type SavedProductImage = {
  clientId: string;
  storagePath: string;
  altText: string | null;
  sortOrder: number;
};

function getIndexedStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''));
}

function getImageOrder(formData: FormData) {
  return formData
    .getAll('imageOrder')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getImageSerialByClientId(formData: FormData) {
  return getImageSerialByClientIdFromOrder(getImageOrder(formData));
}

export function getImageSerialByClientIdFromOrder(imageOrder: string[]) {
  const serialByClientId = new Map<string, number>();

  imageOrder.forEach((item, index) => {
    if (!item.startsWith('new:')) return;
    serialByClientId.set(item.slice(4), index + 1);
  });

  return serialByClientId;
}

export function assertProductImageCountAllowed(count: number) {
  if (count > MAX_PRODUCT_IMAGE_FILES) {
    throw new Error(
      `You can upload up to ${MAX_PRODUCT_IMAGE_FILES} images per product.`,
    );
  }
}

function getImageFiles(formData: FormData) {
  const clientIds = getIndexedStringList(formData, 'productImageClientIds');
  const uploadedClientIds = getIndexedStringList(
    formData,
    'uploadedProductImageClientIds',
  );
  const uploadedObjectKeys = getIndexedStringList(
    formData,
    'uploadedProductImageObjectKeys',
  );
  const uploadedNames = getIndexedStringList(formData, 'uploadedProductImageNames');

  const files: IncomingImageFile[] = formData
    .getAll('productImages')
    .map((value, index) => ({
      clientId: clientIds[index] ?? '',
      file: value,
    }))
    .filter(
      (value): value is { clientId: string; file: File } =>
        value.file instanceof File &&
        value.file.size > 0,
    );

  const uploadedImages: IncomingUploadedImage[] = uploadedObjectKeys
    .map((objectKey, index) => ({
      clientId: uploadedClientIds[index] ?? '',
      fileName: uploadedNames[index] ?? 'image',
      objectKey: objectKey.trim(),
    }))
    .filter((item) => item.objectKey.length > 0);

  assertProductImageCountAllowed(files.length + uploadedImages.length);

  for (const { file } of files) {
    if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPE_SET.has(file.type)) {
      throw new Error(
        `Unsupported image type "${file.type || 'unknown'}". Allowed: JPG, PNG, WEBP, AVIF.`,
      );
    }
    if (file.size > MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES) {
      throw new Error(
        `Image "${file.name}" exceeds ${(MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB limit.`,
      );
    }
  }

  for (const uploadedImage of uploadedImages) {
    if (!isStagedProductImageObjectKey(uploadedImage.objectKey)) {
      throw new Error('Invalid staged product image reference.');
    }
  }

  return {
    files,
    uploadedImages,
  };
}

async function uploadWithUniqueName(
  productStorageFolder: string,
  serialNumber: number,
  extension: string,
  file: File,
  reservedObjectKeys: Set<string>,
) {
  let attempt = 1;

  while (true) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const objectKey = getOriginalObjectKey(
      productStorageFolder,
      serialNumber,
      extension,
      suffix,
    );

    if (!reservedObjectKeys.has(objectKey)) {
      reservedObjectKeys.add(objectKey);
      if (await uploadStorageObject(objectKey, file)) {
        try {
          await uploadOptimizedImageVariants(objectKey, file);
          await assertStorageObjectsExist(getStorageObjectKeysWithVariants(objectKey));
          return objectKey;
        } catch (error) {
          await deleteStorageObjectKeysBestEffort(
            [objectKey],
            'Failed to clean up partially processed product image:',
          );
          throw error;
        }
      }
    }

    attempt += 1;
  }
}

export async function deleteProductImageFiles(storagePaths: string[]) {
  const objectKeys = storagePaths
    .map((storagePath) => getStorageObjectKey(storagePath))
    .filter((objectKey): objectKey is string => Boolean(objectKey))
    .flatMap((objectKey) => getStorageObjectKeysWithVariants(objectKey));

  await deleteProductImageFilesByObjectKeys(objectKeys);
}

export async function deleteProductImageFilesBestEffort(storagePaths: string[]) {
  if (storagePaths.length === 0) return;

  try {
    await deleteProductImageFiles(storagePaths);
  } catch (error) {
    console.error('Failed to delete removed product image files:', error);
  }
}

export async function saveProductImages(
  formData: FormData,
  productStorageFolder: string,
  _imageNameBase: string,
  serialByClientId = getImageSerialByClientId(formData),
) {
  const { files, uploadedImages } = getImageFiles(formData);
  if (files.length === 0 && uploadedImages.length === 0) return [];

  const reservedObjectKeys = new Set<string>();
  const savedImages: SavedProductImage[] = [];

  try {
    for (const [index, { clientId, file }] of files.entries()) {
      const extension = getFileExtensionFromName(file.name, file.type);
      const serialNumber = serialByClientId.get(clientId) ?? index + 1;
      const objectKey = await uploadWithUniqueName(
        productStorageFolder,
        serialNumber,
        extension,
        file,
        reservedObjectKeys,
      );

      savedImages.push({
        clientId,
        storagePath: getPublicStorageUrl(objectKey),
        altText: file.name.replace(/\.[^.]+$/, '') || null,
        sortOrder: serialNumber - 1,
      });
    }

    const savedFileCount = savedImages.length;
    for (const [index, { clientId, fileName, objectKey }] of uploadedImages.entries()) {
      const serialNumber =
        serialByClientId.get(clientId) ?? savedFileCount + index + 1;
      const extension = getFileExtensionFromName(objectKey);
      const sourceBuffer = await downloadStorageObject(objectKey);
      const uniqueSuffix = `-${crypto.randomUUID().slice(0, 8)}`;
      const finalObjectKey = getOriginalObjectKey(
        productStorageFolder,
        serialNumber,
        extension,
        uniqueSuffix,
      );

      try {
        await uploadStorageBuffer(
          finalObjectKey,
          sourceBuffer,
          getContentTypeFromExtension(extension),
        );
        await uploadOptimizedImageVariantsFromBuffer(finalObjectKey, sourceBuffer);
        await assertStorageObjectsExist(
          getStorageObjectKeysWithVariants(finalObjectKey),
        );
      } catch (error) {
        await deleteStorageObjectKeysBestEffort(
          [finalObjectKey],
          'Failed to clean up partially promoted product image:',
        );
        throw error;
      }

      try {
        await deleteStorageObjects([objectKey]);
      } catch (error) {
        console.error('Failed to delete staged product image:', error);
      }

      savedImages.push({
        clientId,
        storagePath: getPublicStorageUrl(finalObjectKey),
        altText: fileName.replace(/\.[^.]+$/, '') || null,
        sortOrder: serialNumber - 1,
      });
    }

    return savedImages;
  } catch (error) {
    await deleteProductImageFilesBestEffort(
      savedImages.map((image) => image.storagePath),
    );
    throw error;
  }
}
