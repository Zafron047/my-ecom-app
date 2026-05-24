import sharp from 'sharp';
import {
  PRODUCT_IMAGE_VARIANTS,
  type ProductImageVariantSuffix,
} from './constants';
import { getVariantObjectKey } from './storage-keys';
import { uploadStorageBuffer } from './supabase-storage';

export function getContentTypeFromExtension(extension: string) {
  const ext = extension.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.avif') return 'image/avif';
  return 'image/jpeg';
}

export async function createProductImageVariants(sourceBuffer: Buffer) {
  return Promise.all(
    PRODUCT_IMAGE_VARIANTS.map(async (variant) => ({
      suffix: variant.suffix,
      bytes: await sharp(sourceBuffer)
        .rotate()
        .resize({
          width: variant.width,
          withoutEnlargement: true,
        })
        .webp({ quality: variant.quality })
        .toBuffer(),
    })),
  );
}

export async function uploadOptimizedImageVariantsFromBuffer(
  objectKey: string,
  sourceBuffer: Buffer,
) {
  const variants = await createProductImageVariants(sourceBuffer);

  for (const variant of variants) {
    await uploadStorageBuffer(
      getVariantObjectKey(
        objectKey,
        variant.suffix as ProductImageVariantSuffix,
      ),
      variant.bytes,
      'image/webp',
    );
  }
}

export async function uploadOptimizedImageVariants(
  objectKey: string,
  file: File,
) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  await uploadOptimizedImageVariantsFromBuffer(objectKey, sourceBuffer);
}
