import {
  PRODUCT_IMAGE_VARIANTS,
  PRODUCT_STORAGE_FOLDER,
  STAGED_PRODUCT_IMAGE_FOLDER,
  type ProductImageVariantSuffix,
} from './constants';
import {
  getOptionalSupabaseStorageConfig,
  getSupabaseStorageBucket,
  getSupabaseStorageConfig,
} from './storage-config';

export function getProductStorageFolder(productId: string) {
  return `${PRODUCT_STORAGE_FOLDER}/${productId}`;
}

export function encodeStorageObjectKey(objectKey: string) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

export function getPublicStorageUrl(objectKey: string) {
  const { bucket, supabaseUrl } = getSupabaseStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStorageObjectKey(
    objectKey,
  )}`;
}

export function getFileExtensionFromName(name: string, contentType?: string) {
  const extensionMatch = name.match(/\.[^./\\]+$/);
  if (extensionMatch) return extensionMatch[0].toLowerCase();

  const fromType = contentType?.split('/')[1];
  return fromType ? `.${fromType.toLowerCase()}` : '.jpg';
}

export function getStorageObjectKey(storagePath: string) {
  const config = getOptionalSupabaseStorageConfig();
  const bucket = config?.bucket ?? getSupabaseStorageBucket();
  const supabaseUrl = config?.supabaseUrl;

  const decodeKey = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  if (supabaseUrl) {
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
    if (storagePath.startsWith(publicPrefix)) {
      return decodeKey(storagePath.slice(publicPrefix.length));
    }
  }

  try {
    const parsed = new URL(storagePath);
    const publicSegment = `/storage/v1/object/public/${bucket}/`;
    const segmentIndex = parsed.pathname.indexOf(publicSegment);
    if (segmentIndex >= 0) {
      return decodeKey(parsed.pathname.slice(segmentIndex + publicSegment.length));
    }
  } catch {
    // Fall through to raw object-key handling.
  }

  if (storagePath.startsWith(`${PRODUCT_STORAGE_FOLDER}/`)) {
    return storagePath;
  }

  return null;
}

export function getVariantObjectKey(
  objectKey: string,
  suffix: ProductImageVariantSuffix,
) {
  if (objectKey.includes('/original/')) {
    return objectKey
      .replace('/original/', `/${suffix}/`)
      .replace(/\.[^./]+$/i, '.webp');
  }

  const extensionMatch = objectKey.match(/\.[^./]+$/);
  if (!extensionMatch) return `${objectKey}-${suffix}.webp`;

  return objectKey.slice(0, -extensionMatch[0].length) + `-${suffix}.webp`;
}

export function getOriginalObjectKey(
  productStorageFolder: string,
  serialNumber: number,
  extension: string,
  suffix = '',
) {
  return `${productStorageFolder}/original/img${serialNumber}${suffix}${extension}`;
}

export function getStorageObjectKeysWithVariants(objectKey: string) {
  return [
    objectKey,
    ...PRODUCT_IMAGE_VARIANTS.map((variant) =>
      getVariantObjectKey(objectKey, variant.suffix),
    ),
  ];
}

export function isStagedProductImageObjectKey(objectKey: string) {
  return objectKey.startsWith(`${STAGED_PRODUCT_IMAGE_FOLDER}/`);
}
