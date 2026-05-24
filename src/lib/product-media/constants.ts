export const PRODUCT_STORAGE_FOLDER = 'products';
export const STAGED_PRODUCT_IMAGE_FOLDER = `${PRODUCT_STORAGE_FOLDER}/staged`;
export const MAX_PRODUCT_IMAGE_FILES = 10;
export const MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;
export const ALLOWED_PRODUCT_IMAGE_MIME_TYPE_SET = new Set<string>(
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
);
export const PRODUCT_IMAGE_VARIANTS = [
  { suffix: 'thumb', width: 320, quality: 72 },
  { suffix: 'detail', width: 1200, quality: 78 },
  { suffix: 'zoom', width: 1800, quality: 75 },
] as const;

export type ProductImageVariantSuffix =
  (typeof PRODUCT_IMAGE_VARIANTS)[number]['suffix'];
