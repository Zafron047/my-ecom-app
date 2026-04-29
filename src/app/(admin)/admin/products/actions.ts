'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import path from 'path';
import sharp from 'sharp';
import { ProductStatus } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

const productStatuses = Object.values(ProductStatus);
const PRODUCT_NAME_WORD_LIMIT = 6;
const SHORT_DESCRIPTION_WORD_LIMIT = 40;
const PRODUCT_STORAGE_FOLDER = 'products';
const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const PRODUCT_IMAGE_VARIANTS = [
  { suffix: 'thumb', width: 320, quality: 72 },
  { suffix: 'detail', width: 1200, quality: 78 },
  { suffix: 'zoom', width: 1800, quality: 75 },
] as const;

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

function normalizeSkuPart(value: string | null) {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.join('-');
}

function getProductInitials(name: string) {
  const initials = name
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.map((part) => part[0])
    .join('');

  return initials || 'PRODUCT';
}

function generateSku(name: string, color: string | null, size: string | null) {
  return [
    getProductInitials(name),
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
  const activeStates = formData.getAll('variantIsActive');
  const rowCount = Math.max(
    colors.length,
    sizes.length,
    prices.length,
    compareAtPrices.length,
    costPrices.length,
    stockQuantities.length,
    activeStates.length,
  );

  return Array.from({ length: rowCount }, (_, index) => ({
    id: ids[index] ?? '',
    color: typeof colors[index] === 'string' ? colors[index].trim() || null : null,
    imageSelection:
      typeof imageSelections[index] === 'string'
        ? imageSelections[index].trim()
        : '',
    size: typeof sizes[index] === 'string' ? sizes[index].trim() || null : null,
    price: parseRequiredDecimal(String(prices[index] ?? ''), 'Price'),
    compareAtPrice: parseOptionalDecimal(String(compareAtPrices[index] ?? '')),
    costPrice: parseOptionalDecimal(String(costPrices[index] ?? '')),
    stockQuantity: parseStock(String(stockQuantities[index] ?? '0')),
    isActive: activeStates[index] !== 'false',
  }));
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

function getProductPayload(formData: FormData) {
  const name = getString(formData, 'name');
  if (!name) {
    throw new Error('Product name is required.');
  }
  if (countWords(name) > PRODUCT_NAME_WORD_LIMIT) {
    throw new Error(`Product name must be ${PRODUCT_NAME_WORD_LIMIT} words or fewer.`);
  }

  const slug = slugify(getString(formData, 'slug') || name);
  if (!slug) {
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

  const variants = getVariantRows(formData);
  if (variants.length === 0) {
    throw new Error('At least one product variant is required.');
  }

  return {
    name,
    slug,
    shortDescription,
    description: getOptionalString(formData, 'description'),
    status: parseStatus(getString(formData, 'status')),
    categoryIds: getStringList(formData, 'categoryIds'),
    specifications: getSpecificationRows(formData),
    variants: variants.map((variant) => ({
      ...variant,
      sku: generateSku(name, variant.color, variant.size),
    })),
  };
}

function getImageFiles(formData: FormData) {
  const clientIds = getIndexedStringList(formData, 'productImageClientIds');

  return formData
    .getAll('productImages')
    .map((value, index) => ({
      clientId: clientIds[index] ?? '',
      file: value,
    }))
    .filter(
      (value): value is { clientId: string; file: File } =>
        value.file instanceof File &&
        value.file.size > 0 &&
        value.file.type.startsWith('image/'),
    );
}

function getFileExtension(file: File) {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName) return fromName;

  const fromType = file.type.split('/')[1];
  return fromType ? `.${fromType}` : '.jpg';
}

function getStoragePathExtension(storagePath: string) {
  try {
    return path.extname(new URL(storagePath).pathname).toLowerCase() || '.jpg';
  } catch {
    return path.extname(storagePath).toLowerCase() || '.jpg';
  }
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
  if (!config) return null;

  const { bucket, supabaseUrl } = config;
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;

  if (!storagePath.startsWith(publicPrefix)) return null;

  try {
    return decodeURIComponent(storagePath.slice(publicPrefix.length));
  } catch {
    return storagePath.slice(publicPrefix.length);
  }
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
  const extension = path.extname(objectKey);
  const base = extension ? objectKey.slice(0, -extension.length) : objectKey;
  return `${base}-${suffix}.webp`;
}

async function uploadOptimizedImageVariants(objectKey: string, file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

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

async function moveStorageObject(sourceKey: string, destinationKey: string) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/move`, {
    body: JSON.stringify({
      bucketId: bucket,
      destinationKey,
      sourceKey,
    }),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (response.status === 409) return false;
  if (!response.ok) {
    throw new Error(`Failed to move product image: ${await response.text()}`);
  }

  return true;
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
  baseName: string,
  extension: string,
  file: File,
  reservedObjectKeys: Set<string>,
) {
  let attempt = 1;

  while (true) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const objectKey = `${PRODUCT_STORAGE_FOLDER}/${baseName}${suffix}${extension}`;

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

async function renameExistingProductImageFiles(
  imageNameBase: string,
  imageOrder: string[],
  existingImages: {
    id: string;
    storagePath: string;
  }[],
) {
  const existingById = new Map(
    existingImages.map((image) => [image.id, image.storagePath]),
  );
  const reservedObjectKeys = new Set<string>();
  const tempPlans: {
    extension: string;
    id: string;
    serialNumber: number;
    tempObjectKey: string;
  }[] = [];
  const storagePathById = new Map<string, string>();

  for (const [index, orderItem] of imageOrder.entries()) {
    if (!orderItem.startsWith('existing:')) continue;

    const imageId = orderItem.slice(9);
    const currentStoragePath = existingById.get(imageId);
    if (!currentStoragePath) continue;

    const currentObjectKey = getStorageObjectKey(currentStoragePath);
    const extension = getStoragePathExtension(currentStoragePath);
    const serialNumber = index + 1;
    const expectedObjectKey = `${PRODUCT_STORAGE_FOLDER}/${imageNameBase}-${serialNumber}${extension}`;

    if (!currentObjectKey) {
      storagePathById.set(imageId, currentStoragePath);
      continue;
    }

    if (currentObjectKey === expectedObjectKey) {
      reservedObjectKeys.add(expectedObjectKey);
      storagePathById.set(imageId, currentStoragePath);
      continue;
    }

    const tempObjectKey = `${PRODUCT_STORAGE_FOLDER}/.tmp/${imageNameBase}-${imageId}-${crypto.randomUUID()}${extension}`;

    await moveStorageObject(currentObjectKey, tempObjectKey);
    tempPlans.push({
      extension,
      id: imageId,
      serialNumber,
      tempObjectKey,
    });
  }

  for (const plan of tempPlans) {
    let attempt = 1;

    while (true) {
      const suffix = attempt === 1 ? '' : `-${attempt}`;
      const nextObjectKey = `${PRODUCT_STORAGE_FOLDER}/${imageNameBase}-${plan.serialNumber}${suffix}${plan.extension}`;

      if (!reservedObjectKeys.has(nextObjectKey)) {
        reservedObjectKeys.add(nextObjectKey);
        if (await moveStorageObject(plan.tempObjectKey, nextObjectKey)) {
          storagePathById.set(plan.id, getPublicStorageUrl(nextObjectKey));
          break;
        }
      }

      attempt += 1;
    }
  }

  return storagePathById;
}

async function deleteProductImageFiles(storagePaths: string[]) {
  const objectKeys = storagePaths
    .map((storagePath) => getStorageObjectKey(storagePath))
    .filter((objectKey): objectKey is string => Boolean(objectKey));

  await deleteStorageObjects(objectKeys);
}

async function saveProductImages(
  formData: FormData,
  imageNameBase: string,
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
        `${imageNameBase}-${serialNumber}`,
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

function getVariantImagePath(
  imageSelection: string,
  storagePathByOrderKey: Map<string, string>,
) {
  if (!imageSelection) return null;
  return storagePathByOrderKey.get(imageSelection) ?? null;
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
  const payload = getProductPayload(formData);
  const variants = await ensureUniqueSkus(payload.variants);

  const product = await prisma.product.create({
    data: {
      name: payload.name,
      slug: payload.slug,
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
    select: {
      id: true,
    },
  });

  const images = await saveProductImages(formData, payload.slug);
  const storagePathByOrderKey = new Map<string, string>();

  images.forEach((image) => {
    storagePathByOrderKey.set(`new:${image.clientId}`, image.storagePath);
  });

  if (images.length > 0) {
    await prisma.productImage.createMany({
      data: images.map((image) => ({
        productId: product.id,
        storagePath: image.storagePath,
        altText: image.altText,
        isPrimary: image.sortOrder === 0,
        sortOrder: image.sortOrder,
      })),
    });
  }

  await prisma.productVariant.createMany({
    data: variants.map((variant) => ({
      productId: product.id,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      imagePath: getVariantImagePath(
        variant.imageSelection,
        storagePathByOrderKey,
      ),
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      costPrice: variant.costPrice,
      stockQuantity: variant.stockQuantity,
      isActive: variant.isActive,
    })),
  });

  revalidatePath('/admin/products');
  redirect(`/admin/products/${product.id}/edit`);
}

export async function updateProduct(formData: FormData) {
  const productId = getString(formData, 'productId');
  await requireAdminPermission(`/admin/products/${productId}/edit`, 'products.write');
  if (!productId) {
    throw new Error('Product id is required.');
  }

  const payload = getProductPayload(formData);
  const variantIdsToRemove = new Set(getStringList(formData, 'removeVariantIds'));
  const specificationIdsToRemove = new Set(
    getStringList(formData, 'removeSpecificationIds'),
  );
  const variantsToKeep = payload.variants.filter(
    (variant) => !variant.id || !variantIdsToRemove.has(variant.id),
  );
  const specificationsToKeep = payload.specifications.filter(
    (specification) =>
      !specification.id || !specificationIdsToRemove.has(specification.id),
  );
  const variants = await ensureUniqueSkus(variantsToKeep);
  const removedImageIds = new Set(getStringList(formData, 'removeImageIds'));
  const imageOrder = getImageOrder(formData);

  const removedImages = removedImageIds.size
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

  await deleteProductImageFiles(removedImages.map((image) => image.storagePath));

  const existingImageIdsInOrder = imageOrder
    .filter((item) => item.startsWith('existing:'))
    .map((item) => item.slice(9))
    .filter((id) => !removedImageIds.has(id));

  const existingImages = existingImageIdsInOrder.length
    ? await prisma.productImage.findMany({
        select: {
          id: true,
          storagePath: true,
        },
        where: {
          id: { in: existingImageIdsInOrder },
          productId,
        },
      })
    : [];

  const renamedExistingStoragePathById = await renameExistingProductImageFiles(
    payload.slug,
    imageOrder,
    existingImages,
  );

  const newImages = await saveProductImages(formData, payload.slug);
  const storagePathByOrderKey = new Map<string, string>();

  for (const orderItem of imageOrder) {
    if (!orderItem.startsWith('existing:')) continue;
    const imageId = orderItem.slice(9);
    const storagePath = renamedExistingStoragePathById.get(imageId);
    if (storagePath) {
      storagePathByOrderKey.set(orderItem, storagePath);
    }
  }

  newImages.forEach((image) => {
    storagePathByOrderKey.set(`new:${image.clientId}`, image.storagePath);
  });

  if (variants.length === 0) {
    throw new Error('At least one active product variant row is required.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        name: payload.name,
        slug: payload.slug,
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

    for (const [index, orderItem] of imageOrder.entries()) {
      if (orderItem.startsWith('existing:')) {
        const imageId = orderItem.slice(9);
        if (removedImageIds.has(imageId)) continue;

        await tx.productImage.updateMany({
          where: {
            id: imageId,
            productId,
          },
          data: {
            isPrimary: index === 0,
            sortOrder: index,
            ...(renamedExistingStoragePathById.has(imageId)
              ? { storagePath: renamedExistingStoragePathById.get(imageId) }
              : {}),
          },
        });
      }
    }

    if (newImages.length > 0) {
      await tx.productImage.createMany({
        data: imageOrder.flatMap((orderItem, index) => {
          if (!orderItem.startsWith('new:')) return [];
          const image = newImageByClientId.get(orderItem.slice(4));
          if (!image) return [];

          return [
            {
              productId,
              storagePath: image.storagePath,
              altText: image.altText,
              isPrimary: index === 0,
              sortOrder: index,
            },
          ];
        }),
      });
    }

    for (const variantId of variantIdsToRemove) {
      const orderUsage = await tx.orderProduct.count({
        where: { variantId },
      });

      if (orderUsage > 0) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { isActive: false },
        });
      } else {
        await tx.productVariant.delete({
          where: { id: variantId },
        });
      }
    }

    for (const variant of variants) {
      const data = {
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        imagePath: getVariantImagePath(
          variant.imageSelection,
          storagePathByOrderKey,
        ),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        costPrice: variant.costPrice,
        stockQuantity: variant.stockQuantity,
        isActive: variant.isActive,
      };

      if (variant.id) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data,
        });
      } else {
        await tx.productVariant.create({
          data: {
            ...data,
            productId,
          },
        });
      }
    }
  });

  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}/edit`);
  redirect(`/admin/products/${productId}/edit`);
}

export async function removeProduct(formData: FormData) {
  const productId = getString(formData, 'productId');
  await requireAdminPermission('/admin/products', 'products.write');
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

export async function unarchiveProduct(formData: FormData) {
  await requireAdminPermission('/admin/products', 'products.write');
  const productId = getString(formData, 'productId');
  if (!productId) {
    throw new Error('Product id is required.');
  }

  await prisma.product.update({
    where: { id: productId },
    data: { status: ProductStatus.active },
  });

  revalidatePath('/admin/products');
}
