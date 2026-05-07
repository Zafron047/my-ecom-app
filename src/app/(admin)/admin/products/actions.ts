'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import path from 'path';
import sharp from 'sharp';
import { Prisma, ProductStatus } from '@prisma/client';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

const productStatuses = Object.values(ProductStatus);
const PRODUCT_NAME_WORD_LIMIT = 6;
const SHORT_DESCRIPTION_WORD_LIMIT = 40;
const PRODUCT_STORAGE_FOLDER = 'products';
const MAX_PRODUCT_IMAGE_FILES = 12;
const MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const PRODUCT_IMAGE_VARIANTS = [
  { suffix: 'thumb', width: 320, quality: 72 },
  { suffix: 'detail', width: 1200, quality: 78 },
  { suffix: 'zoom', width: 1800, quality: 75 },
] as const;

function getProductStorageFolder(productId: string) {
  return `${PRODUCT_STORAGE_FOLDER}/${productId}`;
}

function getSupabaseProjectUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const parsedUrl = new URL(databaseUrl);
    const usernameProjectRef = decodeURIComponent(parsedUrl.username).match(
      /^postgres\.([a-z0-9]+)$/i,
    )?.[1];
    const hostProjectRef = parsedUrl.hostname.match(
      /^(?:db|pooler)\.([a-z0-9]+)\.supabase\.co$/i,
    )?.[1];
    const projectRef = usernameProjectRef ?? hostProjectRef;

    return projectRef ? `https://${projectRef}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.replace(/\/$/, '') ??
    getSupabaseProjectUrlFromDatabaseUrl()
  );
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getImageOrder(formData: FormData) {
  return getStringList(formData, 'imageOrder');
}

function getImageSerialByClientId(formData: FormData) {
  const serialByClientId = new Map<string, number>();

  getImageOrder(formData).forEach((item, index) => {
    if (!item.startsWith('new:')) return;
    serialByClientId.set(item.slice(4), index + 1);
  });

  return serialByClientId;
}

function getImageSerialByClientIdFromOrder(imageOrder: string[]) {
  const serialByClientId = new Map<string, number>();

  imageOrder.forEach((item, index) => {
    if (!item.startsWith('new:')) return;
    serialByClientId.set(item.slice(4), index + 1);
  });

  return serialByClientId;
}

function getIndexedStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''));
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function parseStatus(value: string) {
  return productStatuses.includes(value as ProductStatus)
    ? (value as ProductStatus)
    : ProductStatus.draft;
}

function parseRequiredDecimal(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Number(normalized)) || Number(normalized) < 0) {
    throw new Error(`${label} must be a valid positive amount.`);
  }

  return normalized;
}

function parseOptionalDecimal(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (Number.isNaN(Number(normalized)) || Number(normalized) < 0) {
    throw new Error('Optional prices must be valid positive amounts.');
  }

  return normalized;
}


function parseStock(value: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Stock quantity must be a whole number.');
  }

  return parsed;
}

function parseReorderLevel(value: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Reorder level must be a whole number.');
  }

  return parsed;
}

function normalizeDynamicAttribute(value: string) {
  return value.trim().normalize('NFKC').replace(/\s+/g, ' ');
}

function normalizeSkuPart(value: string | null) {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.join('-');
}

function getProductSkuBase(name: string) {
  const slugParts = slugify(name)
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  const normalized = slugParts
    .map((part) => part.toUpperCase())
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized.join('-');
  }

  return 'PRODUCT';
}

function generateSku(name: string, color: string | null, size: string | null) {
  return [
    getProductSkuBase(name),
    normalizeSkuPart(color),
    normalizeSkuPart(size),
  ]
    .filter(Boolean)
    .join('-');
}

function getVariantRows(formData: FormData) {
  const ids = getIndexedStringList(formData, 'variantId');
  const colors = formData.getAll('variantColor');
  const imageSelections = formData.getAll('variantImageSelection');
  const sizes = formData.getAll('variantSize');
  const prices = formData.getAll('variantPrice');
  const compareAtPrices = formData.getAll('variantCompareAtPrice');
  const costPrices = formData.getAll('variantCostPrice');
  const stockQuantities = formData.getAll('variantStockQuantity');
  const reorderLevels = formData.getAll('variantReorderLevel');
  const activeStates = formData.getAll('variantIsActive');
  const rowCount = Math.max(
    colors.length,
    sizes.length,
    prices.length,
    compareAtPrices.length,
    costPrices.length,
    stockQuantities.length,
    reorderLevels.length,
    activeStates.length,
  );

  return Array.from({ length: rowCount }, (_, index) => {
    const id = ids[index] ?? '';
    const colorRaw =
      typeof colors[index] === 'string'
        ? normalizeDynamicAttribute(colors[index])
        : '';
    const imageSelectionRaw =
      typeof imageSelections[index] === 'string'
        ? imageSelections[index].trim()
        : '';
    const sizeRaw =
      typeof sizes[index] === 'string'
        ? normalizeDynamicAttribute(sizes[index])
        : '';
    const priceRaw = String(prices[index] ?? '').trim();
    const compareAtRaw = String(compareAtPrices[index] ?? '').trim();
    const costRaw = String(costPrices[index] ?? '').trim();
    const stockRaw = String(stockQuantities[index] ?? '0').trim();
    const reorderRaw = String(reorderLevels[index] ?? '10').trim();
    const isActive = activeStates[index] !== 'false';

    const isBlankNewVariant =
      !id &&
      !colorRaw &&
      !sizeRaw &&
      !imageSelectionRaw &&
      !priceRaw &&
      !compareAtRaw &&
      !costRaw;

    if (isBlankNewVariant) return null;

    return {
      id,
      color: colorRaw || null,
      imageSelection: imageSelectionRaw,
      size: sizeRaw || null,
      price: parseRequiredDecimal(priceRaw, 'Price'),
      compareAtPrice: parseOptionalDecimal(compareAtRaw),
      costPrice: parseOptionalDecimal(costRaw),
      stockQuantity: parseStock(stockRaw || '0'),
      reorderLevel: parseReorderLevel(reorderRaw || '10'),
      isActive,
    };
  }).filter((row): row is {
    id: string;
    color: string | null;
    imageSelection: string;
    size: string | null;
    price: string;
    compareAtPrice: string | null;
    costPrice: string | null;
    stockQuantity: number;
    reorderLevel: number;
    isActive: boolean;
  } => row !== null);
}

function getSpecificationRows(formData: FormData) {
  const ids = getIndexedStringList(formData, 'specificationId');
  const names = formData.getAll('specificationName');
  const values = formData.getAll('specificationValue');
  const rowCount = Math.max(ids.length, names.length, values.length);

  return Array.from({ length: rowCount }, (_, index) => {
    const name = typeof names[index] === 'string' ? names[index].trim() : '';
    const value = typeof values[index] === 'string' ? values[index].trim() : '';

    if (!name && !value) return null;
    if (!name || !value) {
      throw new Error('Each specification needs both a name and a value.');
    }

    return {
      id: ids[index] ?? '',
      name,
      sortOrder: index,
      value,
    };
  }).filter((specification): specification is {
    id: string;
    name: string;
    sortOrder: number;
    value: string;
  } => specification !== null);
}

function parseRequiredPositiveInt(value: string, label: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }
  return parsed;
}

function parseRequiredPercentage(value: string, label: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
    throw new Error(`${label} must be a number between 0 and 100.`);
  }
  return normalized;
}

function getBundleOfferRows(formData: FormData) {
  const ids = getIndexedStringList(formData, 'bundleOfferId');
  const titles = formData.getAll('bundleOfferTitle');
  const imageSelections = formData.getAll('bundleOfferImageSelection');
  const variantSelections = formData.getAll('bundleOfferVariantSelection');
  const minTotalQtys = formData.getAll('bundleOfferMinTotalQty');
  const discountPercents = formData.getAll('bundleOfferDiscountPercent');
  const activeStates = formData.getAll('bundleOfferIsActive');
  const rowCount = Math.max(
    ids.length,
    titles.length,
    imageSelections.length,
    variantSelections.length,
    minTotalQtys.length,
    discountPercents.length,
    activeStates.length,
  );

  return Array.from({ length: rowCount }, (_, index) => {
    const id = ids[index] ?? '';
    const title = typeof titles[index] === 'string' ? titles[index].trim() : '';
    const imageSelection =
      typeof imageSelections[index] === 'string'
        ? imageSelections[index].trim()
        : '';
    const variantSelection =
      typeof variantSelections[index] === 'string'
        ? variantSelections[index].trim()
        : '';
    const minTotalQtyRaw =
      typeof minTotalQtys[index] === 'string'
        ? minTotalQtys[index].trim()
        : '';
    const discountPercentRaw =
      typeof discountPercents[index] === 'string'
        ? discountPercents[index].trim()
        : '';
    const isActive = activeStates[index] !== 'false';

    const isBlank =
      !id &&
      !title &&
      !imageSelection &&
      !variantSelection &&
      !minTotalQtyRaw &&
      !discountPercentRaw;
    if (isBlank) return null;

    return {
      id,
      title: title || null,
      imageSelection,
      variantSelection,
      minTotalQty: parseRequiredPositiveInt(
        minTotalQtyRaw,
        'Bundle minimum quantity',
      ),
      discountPercent: parseRequiredPercentage(
        discountPercentRaw,
        'Bundle discount percent',
      ),
      isActive,
    };
  }).filter((row): row is {
    id: string;
    title: string | null;
    imageSelection: string;
    variantSelection: string;
    minTotalQty: number;
    discountPercent: string;
    isActive: boolean;
  } => row !== null);
}

function getProductPayload(
  formData: FormData,
  options?: {
    includeVariants?: boolean;
    includeBundleOffers?: boolean;
    requireCoreFields?: boolean;
  },
) {
  const includeVariants = options?.includeVariants ?? true;
  const includeBundleOffers = options?.includeBundleOffers ?? true;
  const requireCoreFields = options?.requireCoreFields ?? true;
  const name = getString(formData, 'name');
  if (requireCoreFields && !name) {
    throw new Error('Product name is required.');
  }
  if (name && countWords(name) > PRODUCT_NAME_WORD_LIMIT) {
    throw new Error(`Product name must be ${PRODUCT_NAME_WORD_LIMIT} words or fewer.`);
  }

  const slugSource = getString(formData, 'slug') || name;
  const slug = slugify(slugSource);
  if (requireCoreFields && !slug) {
    throw new Error('Product slug is required.');
  }

  const shortDescription = getOptionalString(formData, 'shortDescription');
  if (
    shortDescription &&
    countWords(shortDescription) > SHORT_DESCRIPTION_WORD_LIMIT
  ) {
    throw new Error(
      `Short description must be ${SHORT_DESCRIPTION_WORD_LIMIT} words or fewer.`,
    );
  }

  const variants = includeVariants ? getVariantRows(formData) : [];
  const bundleOffers = includeBundleOffers ? getBundleOfferRows(formData) : [];
  return {
    name,
    slug,
    seoTitle: getOptionalString(formData, 'seoTitle'),
    seoDescription: getOptionalString(formData, 'seoDescription'),
    brandId: getOptionalString(formData, 'brandId'),
    shortDescription,
    description: getOptionalString(formData, 'description'),
    status: parseStatus(getString(formData, 'status')),
    categoryIds: getStringList(formData, 'categoryIds'),
    specifications: getSpecificationRows(formData),
    variants: variants.map((variant) => ({
      ...variant,
      sku: generateSku(name, variant.color, variant.size),
    })),
    bundleOffers,
  };
}

function getCatalogSnapshotFromVariants(
  variants: Array<{
    sku: string;
    price: string;
    compareAtPrice: string | null;
    stockQuantity: number;
  }>,
) {
  if (variants.length === 0) {
    return {
      price: null,
      salePrice: null,
      sku: null,
      stock: 0,
    };
  }

  const priceNumbers = variants.map((variant) => Number(variant.price));
  const compareAtNumbers = variants
    .map((variant) =>
      variant.compareAtPrice === null ? null : Number(variant.compareAtPrice),
    )
    .filter((value): value is number => Number.isFinite(value));

  const lowestPrice = Math.min(...priceNumbers);
  const lowestSalePrice =
    compareAtNumbers.length > 0 ? Math.min(...compareAtNumbers) : null;

  return {
    price: Number.isFinite(lowestPrice) ? lowestPrice.toFixed(2) : null,
    salePrice:
      lowestSalePrice !== null && Number.isFinite(lowestSalePrice)
        ? lowestSalePrice.toFixed(2)
        : null,
    sku: variants[0]?.sku ?? null,
    stock: variants.reduce((sum, variant) => sum + variant.stockQuantity, 0),
  };
}

async function syncProductBundleSummary(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  const activeOffers = await tx.productBundleOffer.findMany({
    where: {
      productId,
      isActive: true,
    },
    orderBy: [{ minTotalQty: 'asc' }, { sortOrder: 'asc' }],
    select: {
      title: true,
      minTotalQty: true,
      discountPercent: true,
    },
  });

  if (activeOffers.length === 0) {
    await tx.product.update({
      where: { id: productId },
      data: {
        hasActiveBundleOffer: false,
        bundleMinTotalQty: null,
        bundleDiscountPercent: null,
        bundleDisplayText: null,
      },
    });
    return;
  }

  const bestOffer = [...activeOffers].sort((a, b) => {
    const discountDiff = b.discountPercent.toNumber() - a.discountPercent.toNumber();
    if (discountDiff !== 0) return discountDiff;
    return a.minTotalQty - b.minTotalQty;
  })[0];

  const promoText =
    bestOffer.title?.trim() ||
    `Buy Min ${bestOffer.minTotalQty} get ${bestOffer.discountPercent.toNumber()}% OFF`;

  await tx.product.update({
    where: { id: productId },
    data: {
      hasActiveBundleOffer: true,
      bundleMinTotalQty: bestOffer.minTotalQty,
      bundleDiscountPercent: bestOffer.discountPercent.toNumber().toString(),
      bundleDisplayText: promoText,
    },
  });
}

function ensureProductReadyForActiveStatus(
  status: ProductStatus,
  readiness: {
    categoryCount: number;
    imageCount: number;
    variantCount: number;
  },
) {
  if (status !== ProductStatus.active) return;

  const blockers: string[] = [];
  if (readiness.categoryCount <= 0) {
    blockers.push('assign at least one category');
  }
  if (readiness.imageCount <= 0) {
    blockers.push('add at least one product image');
  }
  if (readiness.variantCount <= 0) {
    blockers.push('save at least one variant');
  }

  if (blockers.length > 0) {
    throw new Error(
      `Product must stay draft until ready. To activate, ${blockers.join(', ')}.`,
    );
  }
}

function getImageFiles(formData: FormData) {
  const clientIds = getIndexedStringList(formData, 'productImageClientIds');

  const files = formData
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

  if (files.length > MAX_PRODUCT_IMAGE_FILES) {
    throw new Error(
      `You can upload up to ${MAX_PRODUCT_IMAGE_FILES} images per save.`,
    );
  }

  for (const { file } of files) {
    if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPES.has(file.type)) {
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

  return files;
}

function getFileExtension(file: File) {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName) return fromName;

  const fromType = file.type.split('/')[1];
  return fromType ? `.${fromType}` : '.jpg';
}

function getSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Product image uploads require SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_URL too if it cannot be inferred from DATABASE_URL.',
    );
  }

  return {
    bucket: SUPABASE_STORAGE_BUCKET,
    serviceRoleKey,
    supabaseUrl,
  };
}

function getOptionalSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    bucket: SUPABASE_STORAGE_BUCKET,
    serviceRoleKey,
    supabaseUrl,
  };
}

function encodeStorageObjectKey(objectKey: string) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function getPublicStorageUrl(objectKey: string) {
  const { bucket, supabaseUrl } = getSupabaseStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStorageObjectKey(
    objectKey,
  )}`;
}

function getStorageObjectKey(storagePath: string) {
  const config = getOptionalSupabaseStorageConfig();
  const bucket = config?.bucket ?? SUPABASE_STORAGE_BUCKET;
  const supabaseUrl = config?.supabaseUrl;

  const decodeKey = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  // Standard public URL using configured Supabase base URL.
  if (supabaseUrl) {
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
    if (storagePath.startsWith(publicPrefix)) {
      return decodeKey(storagePath.slice(publicPrefix.length));
    }
  }

  // Public URL from any host/domain that still follows Supabase object path shape.
  try {
    const parsed = new URL(storagePath);
    const publicSegment = `/storage/v1/object/public/${bucket}/`;
    const segmentIndex = parsed.pathname.indexOf(publicSegment);
    if (segmentIndex >= 0) {
      return decodeKey(parsed.pathname.slice(segmentIndex + publicSegment.length));
    }
  } catch {
    // fall through to raw key handling
  }

  // Raw object key persisted directly.
  if (storagePath.startsWith(`${PRODUCT_STORAGE_FOLDER}/`)) {
    return storagePath;
  }

  return null;
}

async function uploadStorageObject(objectKey: string, file: File) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      body: fileBytes,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Cache-Control': '31536000',
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      method: 'POST',
    },
  );

  if (response.status === 409) return false;
  if (!response.ok) {
    throw new Error(`Failed to upload product image: ${await response.text()}`);
  }

  return true;
}

async function uploadStorageBuffer(
  objectKey: string,
  bytes: Buffer,
  contentType: string,
) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const bodyBytes = new Uint8Array(bytes);
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      body: bodyBytes,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Cache-Control': '31536000',
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to upload optimized product image: ${await response.text()}`,
    );
  }
}

function getVariantObjectKey(objectKey: string, suffix: string) {
  if (objectKey.includes('/original/')) {
    const replaced = objectKey.replace('/original/', `/${suffix}/`);
    return replaced.replace(/\.[^./]+$/i, '.webp');
  }

  const extension = path.extname(objectKey);
  const base = extension ? objectKey.slice(0, -extension.length) : objectKey;
  return `${base}-${suffix}.webp`;
}

function getOriginalObjectKey(
  productStorageFolder: string,
  serialNumber: number,
  extension: string,
  suffix = '',
) {
  return `${productStorageFolder}/original/img${serialNumber}${suffix}${extension}`;
}

async function uploadOptimizedImageVariants(objectKey: string, file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  await uploadOptimizedImageVariantsFromBuffer(objectKey, sourceBuffer);
}

async function uploadOptimizedImageVariantsFromBuffer(
  objectKey: string,
  sourceBuffer: Buffer,
) {
  for (const variant of PRODUCT_IMAGE_VARIANTS) {
    const optimizedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: variant.width,
        withoutEnlargement: true,
      })
      .webp({ quality: variant.quality })
      .toBuffer();

    await uploadStorageBuffer(
      getVariantObjectKey(objectKey, variant.suffix),
      optimizedBuffer,
      'image/webp',
    );
  }
}

async function deleteStorageObjects(objectKeys: string[]) {
  if (objectKeys.length === 0) return;

  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    body: JSON.stringify({
      prefixes: objectKeys,
    }),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete product image: ${await response.text()}`);
  }
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
        await uploadOptimizedImageVariants(objectKey, file);
        return objectKey;
      }
    }

    attempt += 1;
  }
}

async function deleteProductImageFiles(storagePaths: string[]) {
  const objectKeys = storagePaths
    .map((storagePath) => getStorageObjectKey(storagePath))
    .filter((objectKey): objectKey is string => Boolean(objectKey))
    .flatMap((objectKey) => [
      objectKey,
      ...PRODUCT_IMAGE_VARIANTS.map((variant) =>
        getVariantObjectKey(objectKey, variant.suffix),
      ),
    ]);

  if (objectKeys.length === 0) return;

  const maxAttempts = 4;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await deleteStorageObjects(objectKeys);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  throw new Error(
    `Failed to delete product image(s) from storage after ${maxAttempts} attempts.${lastError instanceof Error ? ` ${lastError.message}` : ''}`,
  );
}

async function saveProductImages(
  formData: FormData,
  productStorageFolder: string,
  _imageNameBase: string,
  serialByClientId = getImageSerialByClientId(formData),
) {
  const files = getImageFiles(formData);
  if (files.length === 0) return [];

  const reservedObjectKeys = new Set<string>();

  return Promise.all(
    files.map(async ({ clientId, file }, index) => {
      const extension = getFileExtension(file);
      const serialNumber = serialByClientId.get(clientId) ?? index + 1;
      const objectKey = await uploadWithUniqueName(
        productStorageFolder,
        serialNumber,
        extension,
        file,
        reservedObjectKeys,
      );

      return {
        clientId,
        storagePath: getPublicStorageUrl(objectKey),
        altText: file.name.replace(/\.[^.]+$/, '') || null,
        sortOrder: serialNumber - 1,
      };
    }),
  );
}

function getVariantImagePaths(
  imageSelection: string,
  storagePathByOrderKey: Map<string, string>,
) {
  const keys = imageSelection
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const paths: string[] = [];

  for (const key of keys) {
    const path = storagePathByOrderKey.get(key);
    if (path && !seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }

  return paths;
}

function getOrderedImageKeysForAssignment(
  preferredOrder: string[],
  storagePathByOrderKey: Map<string, string>,
) {
  const preferredKnownKeys = preferredOrder.filter((key) =>
    storagePathByOrderKey.has(key),
  );

  if (preferredKnownKeys.length > 0) return preferredKnownKeys;
  return [...storagePathByOrderKey.keys()];
}

function buildVariantImagePathsByIndex<
  TVariant extends { imageSelection: string },
>(
  variants: TVariant[],
  storagePathByOrderKey: Map<string, string>,
  orderedImageKeys: string[],
) {
  const selectedKeys = new Set<string>();
  const variantImagePathsByIndex = variants.map((variant) => {
    const selectedPaths = getVariantImagePaths(
      variant.imageSelection,
      storagePathByOrderKey,
    );

    variant.imageSelection
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((key) => {
        if (storagePathByOrderKey.has(key)) {
          selectedKeys.add(key);
        }
      });

    return [...selectedPaths];
  });

  if (variants.length > 0) {
    const firstVariantPaths = variantImagePathsByIndex[0] ?? [];
    const existingFirstVariantPathSet = new Set(firstVariantPaths);

    for (const key of orderedImageKeys) {
      if (selectedKeys.has(key)) continue;
      const unassignedPath = storagePathByOrderKey.get(key);
      if (!unassignedPath || existingFirstVariantPathSet.has(unassignedPath)) {
        continue;
      }
      firstVariantPaths.push(unassignedPath);
      existingFirstVariantPathSet.add(unassignedPath);
    }

    variantImagePathsByIndex[0] = firstVariantPaths;
  }

  return variantImagePathsByIndex;
}

async function ensureUniqueSkus<
  TVariant extends {
    id: string;
    sku: string;
  },
>(variants: TVariant[]) {
  const usedSkus = new Set<string>();
  const variantsWithUniqueSkus: TVariant[] = [];

  for (const variant of variants) {
    let candidate = variant.sku;
    let suffix = 2;

    while (
      usedSkus.has(candidate) ||
      (await prisma.productVariant.findFirst({
        select: { id: true },
        where: {
          sku: candidate,
          ...(variant.id ? { id: { not: variant.id } } : {}),
        },
      }))
    ) {
      candidate = `${variant.sku}-${suffix}`;
      suffix += 1;
    }

    usedSkus.add(candidate);
    variantsWithUniqueSkus.push({
      ...variant,
      sku: candidate,
    });
  }

  return variantsWithUniqueSkus;
}

export async function createProduct(formData: FormData) {
  await requireAdminPermission('/admin/products', 'products.write');
  await requireAdminRole('/admin/products', ['admin']);
  const payload = getProductPayload(formData);
  const variants = await ensureUniqueSkus(payload.variants);
  const catalogSnapshot = getCatalogSnapshotFromVariants(variants);
  const productId = crypto.randomUUID();

  const images = await saveProductImages(
    formData,
    getProductStorageFolder(productId),
    payload.slug,
  );
  const storagePathByOrderKey = new Map<string, string>();

  images.forEach((image) => {
    storagePathByOrderKey.set(`new:${image.clientId}`, image.storagePath);
  });
  const orderedImageKeys = getOrderedImageKeysForAssignment(
    getImageOrder(formData),
    storagePathByOrderKey,
  );
  ensureProductReadyForActiveStatus(payload.status, {
    categoryCount: payload.categoryIds.length,
    imageCount: images.length,
    variantCount: variants.length,
  });
  const variantImagePathsByIndex = buildVariantImagePathsByIndex(
    variants,
    storagePathByOrderKey,
    orderedImageKeys,
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          id: productId,
          name: payload.name,
          slug: payload.slug,
          sku: catalogSnapshot.sku,
          price: catalogSnapshot.price,
          salePrice: catalogSnapshot.salePrice,
          stock: catalogSnapshot.stock,
          seoTitle: payload.seoTitle,
          seoDescription: payload.seoDescription,
          brandId: payload.brandId,
          shortDescription: payload.shortDescription,
          description: payload.description,
          status: payload.status,
          categories: {
            create: payload.categoryIds.map((categoryId) => ({
              category: {
                connect: { id: categoryId },
              },
            })),
          },
          specifications: {
            create: payload.specifications.map((specification) => ({
              name: specification.name,
              value: specification.value,
              sortOrder: specification.sortOrder,
            })),
          },
        },
      });

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((image) => ({
            productId,
            storagePath: image.storagePath,
            altText: image.altText,
            isPrimary: image.sortOrder === 0,
            sortOrder: image.sortOrder,
          })),
        });
      }

      const variantIdBySelectionKey = new Map<string, string>();
      for (const [index, variant] of variants.entries()) {
        const variantImagePaths = variantImagePathsByIndex[index] ?? [];
        const createdVariant = await tx.productVariant.create({
          data: {
            productId,
            sku: variant.sku,
            sortOrder: index,
            color: variant.color,
            size: variant.size,
            imagePath: variantImagePaths[0] ?? null,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            costPrice: variant.costPrice,
            stockQuantity: variant.stockQuantity,
            reorderLevel: variant.reorderLevel,
            isActive: variant.isActive,
            variantImages:
              variantImagePaths.length > 0
                ? {
                    createMany: {
                      data: variantImagePaths.map((imagePath, imageIndex) => ({
                        imagePath,
                        sortOrder: imageIndex,
                      })),
                    },
                  }
                : undefined,
          },
          select: { id: true },
        });
        if (variant.id) {
          variantIdBySelectionKey.set(`existing:${variant.id}`, createdVariant.id);
        }
      }

      for (const [index, offer] of payload.bundleOffers.entries()) {
        const requestedVariantIds = offer.variantSelection
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .map((key) => variantIdBySelectionKey.get(key) || '')
          .filter(Boolean);
        const allVariantIds = [...variantIdBySelectionKey.values()];
        const variantIds =
          requestedVariantIds.length > 0 ? requestedVariantIds : allVariantIds;
        if (variantIds.length === 0) {
          throw new Error(
            'Bundle offer variants must reference saved variants. Save variants first.',
          );
        }
        const imagePath = offer.imageSelection
          ? getVariantImagePaths(offer.imageSelection, storagePathByOrderKey)[0] ?? null
          : null;
        const createdOffer = await tx.productBundleOffer.create({
          data: {
            productId,
            title: offer.title,
            imagePath,
            minTotalQty: offer.minTotalQty,
            discountPercent: offer.discountPercent,
            isActive: offer.isActive,
            sortOrder: index,
          },
          select: { id: true },
        });
        await tx.productBundleOfferVariant.createMany({
          data: variantIds.map((variantId) => ({
            bundleOfferId: createdOffer.id,
            variantId,
          })),
          skipDuplicates: true,
        });
      }

      await syncProductBundleSummary(tx, productId);
    });
  } catch (error) {
    if (images.length > 0) {
      try {
        await deleteProductImageFiles(images.map((image) => image.storagePath));
      } catch (cleanupError) {
        console.error('Failed to clean up staged product images:', cleanupError);
      }
    }
    throw error;
  }

  revalidatePath('/admin/products');
  redirect(`/admin/products/${productId}/edit`);
}

export async function updateProduct(formData: FormData) {
  const productId = getString(formData, 'productId');
  await requireAdminPermission(`/admin/products/${productId}/edit`, 'products.write');
  await requireAdminRole(`/admin/products/${productId}/edit`, ['admin']);
  if (!productId) {
    throw new Error('Product id is required.');
  }

  const submitIntent = getString(formData, 'submitIntent');
  const shouldSaveProductMedia =
    submitIntent !== 'variants' && submitIntent !== 'bundleOffers';
  const shouldSaveVariants =
    submitIntent === 'variants' || submitIntent === 'full' || submitIntent === '';
  const shouldSaveBundleOffers =
    submitIntent === 'bundleOffers' || submitIntent === 'full' || submitIntent === '';
  const payload = getProductPayload(formData, {
    includeVariants: shouldSaveVariants,
    includeBundleOffers: shouldSaveBundleOffers,
    requireCoreFields: shouldSaveProductMedia || shouldSaveVariants,
  });
  const variantIdsToRemove = new Set(getStringList(formData, 'removeVariantIds'));
  const bundleOfferIdsToRemove = new Set(
    getStringList(formData, 'removeBundleOfferIds'),
  );
  const specificationIdsToRemove = new Set(
    getStringList(formData, 'removeSpecificationIds'),
  );
  const variantsToKeep = payload.variants.filter(
    (variant) => !variant.id || !variantIdsToRemove.has(variant.id),
  );
  const bundleOffersToKeep = payload.bundleOffers.filter(
    (offer) => !offer.id || !bundleOfferIdsToRemove.has(offer.id),
  );
  const specificationsToKeep = payload.specifications.filter(
    (specification) =>
      !specification.id || !specificationIdsToRemove.has(specification.id),
  );
  const variants = shouldSaveVariants
    ? await ensureUniqueSkus(variantsToKeep)
    : [];
  const catalogSnapshot = shouldSaveVariants
    ? getCatalogSnapshotFromVariants(variants)
    : null;
  const persistedVariantCount = shouldSaveVariants
    ? variants.length
    : await prisma.productVariant.count({
        where: {
          productId,
        },
      });
  const removedImageIds = shouldSaveProductMedia
    ? new Set(getStringList(formData, 'removeImageIds'))
    : new Set<string>();
  const imageOrder = shouldSaveProductMedia ? getImageOrder(formData) : [];

  const removedImages = shouldSaveProductMedia && removedImageIds.size
    ? await prisma.productImage.findMany({
        select: {
          storagePath: true,
        },
        where: {
          id: { in: [...removedImageIds] },
          productId,
        },
      })
    : [];

  if (shouldSaveProductMedia) {
    await deleteProductImageFiles(removedImages.map((image) => image.storagePath));
  }

  const existingImages = await prisma.productImage.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      storagePath: true,
    },
    where: {
      id: {
        notIn: [...removedImageIds],
      },
      productId,
    },
  });
  const existingImageIdSet = new Set(existingImages.map((image) => image.id));

  const fallbackExistingOrder = existingImages.map(
    (image) => `existing:${image.id}`,
  );
  const normalizedImageOrder = shouldSaveProductMedia
    ? (() => {
        const filteredRequestedImageOrder = imageOrder.filter((item) => {
          if (!item.startsWith('existing:')) return true;
          return existingImageIdSet.has(item.slice(9));
        });
        const baseImageOrder =
          filteredRequestedImageOrder.length > 0
            ? filteredRequestedImageOrder
            : fallbackExistingOrder;
        return [
          ...baseImageOrder,
          ...fallbackExistingOrder.filter((item) => !baseImageOrder.includes(item)),
        ];
      })()
    : fallbackExistingOrder;
  const existingImageIdsInOrder = normalizedImageOrder
    .filter((item) => item.startsWith('existing:'))
    .map((item) => item.slice(9))
    .filter((id) => existingImageIdSet.has(id));

  const newImages = shouldSaveProductMedia
    ? await saveProductImages(
        formData,
        getProductStorageFolder(productId),
        payload.slug,
        getImageSerialByClientIdFromOrder(normalizedImageOrder),
      )
    : [];
  const storagePathByOrderKey = new Map<string, string>();
  const existingStoragePathById = new Map(
    existingImages.map((image) => [image.id, image.storagePath]),
  );

  for (const orderItem of normalizedImageOrder) {
    if (!orderItem.startsWith('existing:')) continue;
    const imageId = orderItem.slice(9);
    const storagePath = existingStoragePathById.get(imageId);
    if (storagePath) {
      storagePathByOrderKey.set(orderItem, storagePath);
    }
  }

  newImages.forEach((image) => {
    storagePathByOrderKey.set(`new:${image.clientId}`, image.storagePath);
  });
  const orderedImageKeys = getOrderedImageKeysForAssignment(
    normalizedImageOrder,
    storagePathByOrderKey,
  );
  const projectedImageCount = shouldSaveProductMedia
    ? existingImages.length + newImages.length
    : await prisma.productImage.count({
        where: { productId },
      });
  const projectedCategoryCount = shouldSaveProductMedia
    ? payload.categoryIds.length
    : await prisma.productCategory.count({
        where: { productId },
      });
  ensureProductReadyForActiveStatus(payload.status, {
    categoryCount: projectedCategoryCount,
    imageCount: projectedImageCount,
    variantCount: persistedVariantCount,
  });
  const variantImagePathsByIndex = shouldSaveVariants
    ? buildVariantImagePathsByIndex(variants, storagePathByOrderKey, orderedImageKeys)
    : [];

  await prisma.$transaction(async (tx) => {
    if (shouldSaveProductMedia) {
      await tx.product.update({
        where: { id: productId },
        data: {
          name: payload.name,
          slug: payload.slug,
          seoTitle: payload.seoTitle,
          seoDescription: payload.seoDescription,
          brandId: payload.brandId,
          shortDescription: payload.shortDescription,
          description: payload.description,
          status: payload.status,
        },
      });

      await tx.productCategory.deleteMany({
        where: { productId },
      });

      if (payload.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: payload.categoryIds.map((categoryId) => ({
            productId,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      if (specificationIdsToRemove.size > 0) {
        await tx.productSpecification.deleteMany({
          where: {
            id: { in: [...specificationIdsToRemove] },
            productId,
          },
        });
      }

      for (const specification of specificationsToKeep) {
        const data = {
          name: specification.name,
          value: specification.value,
          sortOrder: specification.sortOrder,
        };

        if (specification.id) {
          await tx.productSpecification.update({
            where: { id: specification.id },
            data,
          });
        } else {
          await tx.productSpecification.create({
            data: {
              ...data,
              productId,
            },
          });
        }
      }

      if (removedImageIds.size > 0) {
        await tx.productImage.deleteMany({
          where: {
            id: { in: [...removedImageIds] },
            productId,
          },
        });
      }

      const newImageByClientId = new Map(
        newImages.map((image) => [image.clientId, image]),
      );
      const orderedPersistableKeys = normalizedImageOrder.filter((orderItem) => {
        if (orderItem.startsWith('existing:')) {
          const imageId = orderItem.slice(9);
          return existingImageIdsInOrder.includes(imageId);
        }

        if (orderItem.startsWith('new:')) {
          return newImageByClientId.has(orderItem.slice(4));
        }

        return false;
      });
      const orderIndexByKey = new Map(
        orderedPersistableKeys.map((orderItem, index) => [orderItem, index]),
      );

      for (const orderItem of normalizedImageOrder) {
        if (!orderItem.startsWith('existing:')) continue;
        const imageId = orderItem.slice(9);
        if (removedImageIds.has(imageId)) continue;
        const normalizedIndex = orderIndexByKey.get(orderItem);
        if (typeof normalizedIndex !== 'number') continue;

        await tx.productImage.updateMany({
          where: {
            id: imageId,
            productId,
          },
          data: {
            isPrimary: normalizedIndex === 0,
            sortOrder: normalizedIndex,
          },
        });
      }

      if (newImages.length > 0) {
        await tx.productImage.createMany({
          data: normalizedImageOrder.flatMap((orderItem) => {
            if (!orderItem.startsWith('new:')) return [];
            const image = newImageByClientId.get(orderItem.slice(4));
            const normalizedIndex = orderIndexByKey.get(orderItem);
            if (!image) return [];
            if (typeof normalizedIndex !== 'number') return [];

            return [
              {
                productId,
                storagePath: image.storagePath,
                altText: image.altText,
                isPrimary: normalizedIndex === 0,
                sortOrder: normalizedIndex,
              },
            ];
          }),
        });
      }
    }

    if (shouldSaveVariants) {
      for (const variantId of variantIdsToRemove) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { isActive: false },
        });
        await tx.productBundleOfferVariant.deleteMany({
          where: { variantId },
        });
      }

      const variantIdBySelectionKey = new Map<string, string>();

      for (const [index, variant] of variants.entries()) {
        if (!shouldSaveProductMedia && variant.imageSelection.startsWith('new:')) {
          throw new Error(
            'Save Product & Media first, then assign newly uploaded images to variants.',
          );
        }

        const data = {
          sku: variant.sku,
          sortOrder: index,
          color: variant.color,
          size: variant.size,
          imagePath: (variantImagePathsByIndex[index] ?? [])[0] ?? null,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          costPrice: variant.costPrice,
          stockQuantity: variant.stockQuantity,
          reorderLevel: variant.reorderLevel,
          isActive: variant.isActive,
        };

        if (variant.id) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data,
          });
          variantIdBySelectionKey.set(`existing:${variant.id}`, variant.id);
          const variantImagePaths = variantImagePathsByIndex[index] ?? [];
          await tx.productVariantImage.deleteMany({
            where: { variantId: variant.id },
          });
          if (variantImagePaths.length > 0) {
            await tx.productVariantImage.createMany({
              data: variantImagePaths.map((imagePath, imageIndex) => ({
                variantId: variant.id,
                imagePath,
                sortOrder: imageIndex,
              })),
            });
          }
        } else {
          const variantImagePaths = variantImagePathsByIndex[index] ?? [];
          const createdVariant = await tx.productVariant.create({
            data: {
              ...data,
              productId,
              variantImages:
                variantImagePaths.length > 0
                  ? {
                      createMany: {
                        data: variantImagePaths.map((imagePath, imageIndex) => ({
                          imagePath,
                          sortOrder: imageIndex,
                        })),
                      },
                    }
                  : undefined,
            },
            select: { id: true },
          });
          variantIdBySelectionKey.set(`created:${index}`, createdVariant.id);
        }
      }

      if (catalogSnapshot) {
        await tx.product.update({
          where: { id: productId },
          data: {
            sku: catalogSnapshot.sku,
            price: catalogSnapshot.price,
            salePrice: catalogSnapshot.salePrice,
            stock: catalogSnapshot.stock,
          },
        });
      }

      if (shouldSaveBundleOffers) {
        if (bundleOfferIdsToRemove.size > 0) {
          await tx.productBundleOffer.deleteMany({
            where: {
              id: { in: [...bundleOfferIdsToRemove] },
              productId,
            },
          });
        }

        for (const [index, offer] of bundleOffersToKeep.entries()) {
          if (!shouldSaveProductMedia && offer.imageSelection.startsWith('new:')) {
            throw new Error(
              'Save Product & Media first, then assign newly uploaded images to bundle offers.',
            );
          }

          const requestedVariantIds = offer.variantSelection
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .map((key) => variantIdBySelectionKey.get(key) || '')
            .filter(Boolean);
          const allVariantIds = [...variantIdBySelectionKey.values()];
          const variantIds =
            requestedVariantIds.length > 0 ? requestedVariantIds : allVariantIds;
          if (variantIds.length === 0) {
            throw new Error('Each bundle offer needs at least one valid variant.');
          }

          const imagePath = offer.imageSelection
            ? getVariantImagePaths(offer.imageSelection, storagePathByOrderKey)[0] ?? null
            : null;
          const data = {
            title: offer.title,
            imagePath,
            minTotalQty: offer.minTotalQty,
            discountPercent: offer.discountPercent,
            isActive: offer.isActive,
            sortOrder: index,
          };

          const bundleOfferId = offer.id
            ? (
                await tx.productBundleOffer.update({
                  where: { id: offer.id },
                  data,
                  select: { id: true },
                })
              ).id
            : (
                await tx.productBundleOffer.create({
                  data: {
                    ...data,
                    productId,
                  },
                  select: { id: true },
                })
              ).id;

          await tx.productBundleOfferVariant.deleteMany({
            where: { bundleOfferId },
          });
          await tx.productBundleOfferVariant.createMany({
            data: variantIds.map((variantId) => ({
              bundleOfferId,
              variantId,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    if (shouldSaveBundleOffers && !shouldSaveVariants) {
      const existingVariants = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true },
      });
      const variantIdBySelectionKey = new Map(
        existingVariants.map((variant) => [`existing:${variant.id}`, variant.id]),
      );

      if (bundleOfferIdsToRemove.size > 0) {
        await tx.productBundleOffer.deleteMany({
          where: {
            id: { in: [...bundleOfferIdsToRemove] },
            productId,
          },
        });
      }

      for (const [index, offer] of bundleOffersToKeep.entries()) {
        if (!shouldSaveProductMedia && offer.imageSelection.startsWith('new:')) {
          throw new Error(
            'Save Product & Media first, then assign newly uploaded images to bundle offers.',
          );
        }

        const requestedVariantIds = offer.variantSelection
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .map((key) => variantIdBySelectionKey.get(key) || '')
          .filter(Boolean);
        const allVariantIds = [...variantIdBySelectionKey.values()];
        const variantIds =
          requestedVariantIds.length > 0 ? requestedVariantIds : allVariantIds;
        if (variantIds.length === 0) {
          throw new Error('Each bundle offer needs at least one valid variant.');
        }

        const imagePath = offer.imageSelection
          ? getVariantImagePaths(offer.imageSelection, storagePathByOrderKey)[0] ?? null
          : null;
        const data = {
          title: offer.title,
          imagePath,
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent,
          isActive: offer.isActive,
          sortOrder: index,
        };

        const bundleOfferId = offer.id
          ? (
              await tx.productBundleOffer.update({
                where: { id: offer.id },
                data,
                select: { id: true },
              })
            ).id
          : (
              await tx.productBundleOffer.create({
                data: {
                  ...data,
                  productId,
                },
                select: { id: true },
              })
            ).id;

        await tx.productBundleOfferVariant.deleteMany({
          where: { bundleOfferId },
        });
        await tx.productBundleOfferVariant.createMany({
          data: variantIds.map((variantId) => ({
            bundleOfferId,
            variantId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Safety cleanup: inactive variants should never stay linked as bundle-eligible.
    await tx.productBundleOfferVariant.deleteMany({
      where: {
        variant: {
          productId,
          isActive: false,
        },
      },
    });

    if (shouldSaveBundleOffers) {
      await syncProductBundleSummary(tx, productId);
    }
  });

  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}/edit`);
  redirect(`/admin/products/${productId}/edit`);
}

export async function removeProduct(formData: FormData) {
  const productId = getString(formData, 'productId');
  await requireAdminPermission('/admin/products', 'products.write');
  await requireAdminRole('/admin/products', ['admin']);
  if (!productId) {
    throw new Error('Product id is required.');
  }

  await removeProductById(productId);
  revalidatePath('/admin/products');
}

async function removeProductById(productId: string) {
  const orderUsage = await prisma.orderProduct.count({
    where: { productId },
  });

  if (orderUsage > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.archived },
    });
  } else {
    await prisma.product.delete({
      where: { id: productId },
    });
  }
}

export async function removeProductsBulk(formData: FormData) {
  await requireAdminPermission('/admin/products', 'products.write');
  await requireAdminRole('/admin/products', ['admin']);
  const productIds = formData
    .getAll('productIds')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (productIds.length === 0) {
    throw new Error('Select at least one product to remove.');
  }

  for (const productId of productIds) {
    await removeProductById(productId);
  }

  revalidatePath('/admin/products');
}

export async function applyProductsBulkAction(formData: FormData) {
  await requireAdminPermission('/admin/products', 'products.write');
  await requireAdminRole('/admin/products', ['admin']);

  const productIds = formData
    .getAll('productIds')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  const bulkAction = getString(formData, 'bulkAction');

  if (productIds.length === 0) {
    throw new Error('Select at least one product.');
  }
  if (!bulkAction) {
    throw new Error('Choose a bulk action first.');
  }

  if (bulkAction === 'archive') {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { status: ProductStatus.archived },
    });
    revalidatePath('/admin/products');
    return;
  }

  if (bulkAction === 'unarchive') {
    await prisma.product.updateMany({
      where: { id: { in: productIds }, status: ProductStatus.archived },
      data: { status: ProductStatus.draft },
    });
    revalidatePath('/admin/products');
    return;
  }

  if (bulkAction === 'set-draft' || bulkAction === 'set-archived') {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        status:
          bulkAction === 'set-draft'
            ? ProductStatus.draft
            : ProductStatus.archived,
      },
    });
    revalidatePath('/admin/products');
    return;
  }

  if (bulkAction === 'set-active') {
    const selected = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        categories: { select: { categoryId: true }, take: 1 },
        images: { select: { id: true }, take: 1 },
        variants: { select: { id: true }, take: 1 },
      },
    });
    const notReady = selected.filter(
      (product) =>
        product.categories.length === 0 ||
        product.images.length === 0 ||
        product.variants.length === 0,
    );
    const readyIds = selected
      .filter((product) => !notReady.some((item) => item.id === product.id))
      .map((product) => product.id);

    if (readyIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: readyIds } },
        data: { status: ProductStatus.active },
      });
    }
    revalidatePath('/admin/products');
    return;
  }

  throw new Error('Unsupported bulk action.');
}

export type ProductsBulkActionState = {
  error: string | null;
  message: string | null;
  appliedCount: number;
  skipped: Array<{
    id: string;
    name: string;
    reasons: string[];
  }>;
};

export const INITIAL_PRODUCTS_BULK_ACTION_STATE: ProductsBulkActionState = {
  error: null,
  message: null,
  appliedCount: 0,
  skipped: [],
};

export async function applyProductsBulkActionWithState(
  _prevState: ProductsBulkActionState,
  formData: FormData,
): Promise<ProductsBulkActionState> {
  await requireAdminPermission('/admin/products', 'products.write');
  await requireAdminRole('/admin/products', ['admin']);

  const productIds = formData
    .getAll('productIds')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  const bulkAction = getString(formData, 'bulkAction');

  if (productIds.length === 0) {
    return {
      ...INITIAL_PRODUCTS_BULK_ACTION_STATE,
      error: 'Select at least one product.',
    };
  }
  if (!bulkAction) {
    return {
      ...INITIAL_PRODUCTS_BULK_ACTION_STATE,
      error: 'Choose a bulk action first.',
    };
  }

  if (bulkAction === 'set-active') {
    const selected = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        categories: { select: { categoryId: true }, take: 1 },
        images: { select: { id: true }, take: 1 },
        variants: { select: { id: true }, take: 1 },
      },
    });

    const skipped = selected
      .map((product) => {
        const reasons: string[] = [];
        if (product.categories.length === 0) reasons.push('Missing category');
        if (product.images.length === 0) reasons.push('Missing image');
        if (product.variants.length === 0) reasons.push('Missing variant');
        return {
          id: product.id,
          name: product.name,
          reasons,
        };
      })
      .filter((item) => item.reasons.length > 0);

    const skippedIds = new Set(skipped.map((item) => item.id));
    const readyIds = selected
      .filter((product) => !skippedIds.has(product.id))
      .map((product) => product.id);

    if (readyIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: readyIds } },
        data: { status: ProductStatus.active },
      });
    }

    revalidatePath('/admin/products');
    return {
      error: null,
      message:
        skipped.length > 0
          ? `Activated ${readyIds.length} products. Skipped ${skipped.length} not-ready products.`
          : `Activated ${readyIds.length} products.`,
      appliedCount: readyIds.length,
      skipped,
    };
  }

  if (bulkAction === 'set-draft' || bulkAction === 'set-archived') {
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        status:
          bulkAction === 'set-draft'
            ? ProductStatus.draft
            : ProductStatus.archived,
      },
    });
    revalidatePath('/admin/products');
    return {
      error: null,
      message: `Updated status for ${result.count} products.`,
      appliedCount: result.count,
      skipped: [],
    };
  }

  if (bulkAction === 'archive') {
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { status: ProductStatus.archived },
    });
    revalidatePath('/admin/products');
    return {
      error: null,
      message: `Archived ${result.count} products.`,
      appliedCount: result.count,
      skipped: [],
    };
  }

  if (bulkAction === 'unarchive') {
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds }, status: ProductStatus.archived },
      data: { status: ProductStatus.draft },
    });
    revalidatePath('/admin/products');
    return {
      error: null,
      message: `Unarchived ${result.count} products to draft.`,
      appliedCount: result.count,
      skipped: [],
    };
  }

  return {
    ...INITIAL_PRODUCTS_BULK_ACTION_STATE,
    error: 'Unsupported bulk action.',
  };
}

export async function unarchiveProduct(formData: FormData) {
  await requireAdminPermission('/admin/products', 'products.write');
  await requireAdminRole('/admin/products', ['admin']);
  const productId = getString(formData, 'productId');
  if (!productId) {
    throw new Error('Product id is required.');
  }

  await prisma.product.update({
    where: { id: productId },
    data: { status: ProductStatus.draft },
  });

  revalidatePath('/admin/products');
}

export async function updateVariantInventory(formData: FormData) {
  await requireAdminPermission('/admin/products/stock', 'products.write');
  await requireAdminRole('/admin/products/stock', ['admin']);

  const variantId = getString(formData, 'variantId');
  if (!variantId) {
    throw new Error('Variant id is required.');
  }

  const stockQuantity = parseStock(getString(formData, 'stockQuantity'));
  const reorderLevel = parseReorderLevel(getString(formData, 'reorderLevel'));
  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      stockQuantity,
      reorderLevel,
    },
  });
}
