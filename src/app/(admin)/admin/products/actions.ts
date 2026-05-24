'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, ProductStatus } from '@prisma/client';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import {
  assertProductImageCountAllowed,
  deleteProductImageFiles,
  deleteProductImageFilesBestEffort,
  getImageSerialByClientIdFromOrder,
  saveProductImages,
} from '@/lib/product-media/product-image-service';
import { getProductStorageFolder } from '@/lib/product-media/storage-keys';
import { prisma } from '@/lib/prisma';

const productStatuses = Object.values(ProductStatus);
const PRODUCT_NAME_WORD_LIMIT = 6;
const SHORT_DESCRIPTION_WORD_LIMIT = 40;

function revalidateStorefrontProduct(productId?: string) {
  revalidateTag('storefront-catalog', 'max');
  revalidateTag('storefront-products', 'max');
  revalidateTag('storefront-categories', 'max');
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/api/storefront/catalog');
  if (productId) {
    revalidatePath(`/products/${productId}`);
    revalidatePath(`/api/storefront/products/${productId}`);
  }
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


function normalizeDynamicAttribute(value: string) {
  return value.trim().normalize('NFKC').replace(/\s+/g, ' ');
}
function normalizeColorHex(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const hexValue = trimmedValue.startsWith('#')
    ? trimmedValue.slice(1)
    : trimmedValue;

  if (/^[0-9a-f]{6}$/i.test(hexValue)) {
    return `#${hexValue.toLowerCase()}`;
  }

  if (/^[0-9a-f]{3}$/i.test(hexValue)) {
    return `#${Array.from(hexValue.toLowerCase())
      .map((char) => `${char}${char}`)
      .join('')}`;
  }

  throw new Error('Color hex must be a valid 3 or 6 digit hex code.');
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
    normalizeSkuPart(size),
    normalizeSkuPart(color),
  ]
    .filter(Boolean)
    .join('-');
}

function getVariantRows(formData: FormData) {
  const ids = getIndexedStringList(formData, 'variantId');
  const colors = formData.getAll('variantColor');
  const colorHexes = formData.getAll('variantColorHex');
  const imageSelections = formData.getAll('variantImageSelection');
  const sizes = formData.getAll('variantSize');
  const prices = formData.getAll('variantPrice');
  const compareAtPrices = formData.getAll('variantCompareAtPrice');
  const activeStates = formData.getAll('variantIsActive');
  const rowCount = Math.max(
    colors.length,
    colorHexes.length,
    sizes.length,
    prices.length,
    compareAtPrices.length,
    activeStates.length,
  );

  return Array.from({ length: rowCount }, (_, index) => {
    const id = ids[index] ?? '';
    const colorRaw =
      typeof colors[index] === 'string'
        ? normalizeDynamicAttribute(colors[index])
        : '';
    const colorHexRaw =
      typeof colorHexes[index] === 'string'
        ? colorHexes[index].trim()
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
    const isActive = activeStates[index] !== 'false';

    const isBlankNewVariant =
      !id &&
      !colorRaw &&
      !colorHexRaw &&
      !sizeRaw &&
      !imageSelectionRaw &&
      !priceRaw &&
      !compareAtRaw;

    if (isBlankNewVariant) return null;

    return {
      id,
      color: colorRaw || null,
      colorHex: normalizeColorHex(colorHexRaw),
      imageSelection: imageSelectionRaw,
      size: sizeRaw || null,
      price: parseRequiredDecimal(priceRaw, 'Price'),
      compareAtPrice: parseOptionalDecimal(compareAtRaw),
      isActive,
    };
  }).filter((row): row is {
    id: string;
    color: string | null;
    colorHex: string | null;
    imageSelection: string;
    size: string | null;
    price: string;
    compareAtPrice: string | null;
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
    if (isActive && !variantSelection) {
      throw new Error(
        'Active bundle offers must include at least one eligible variant.',
      );
    }

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

  const description = getOptionalString(formData, 'description');
  if (requireCoreFields && !description) {
    throw new Error('Product description is required.');
  }

  const categoryIds = getStringList(formData, 'categoryIds');
  if (requireCoreFields && categoryIds.length === 0) {
    throw new Error('Select at least one product category.');
  }

  const variants = includeVariants ? getVariantRows(formData) : [];
  if (includeVariants) {
    ensureRequiredVariantRows(variants);
  }
  const bundleOffers = includeBundleOffers ? getBundleOfferRows(formData) : [];
  return {
    name,
    slug,
    seoTitle: getOptionalString(formData, 'seoTitle'),
    seoDescription: getOptionalString(formData, 'seoDescription'),
    brandId: getOptionalString(formData, 'brandId'),
    shortDescription,
    description,
    status: parseStatus(getString(formData, 'status')),
    categoryIds,
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
    stock: 0,
  };
}

function ensureRequiredVariantRows(
  variants: Array<{
    color: string | null;
    colorHex: string | null;
    price: string;
  }>,
) {
  if (variants.length === 0) {
    throw new Error(
      'Add at least one variant with color name, color hex, and price.',
    );
  }

  variants.forEach((variant, index) => {
    const label = `Variant ${index + 1}`;

    if (!variant.color) {
      throw new Error(`${label} color name is required.`);
    }
    if (!variant.colorHex) {
      throw new Error(`${label} color hex is required.`);
    }
    if (!variant.price) {
      throw new Error(`${label} price is required.`);
    }
  });
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

function ensureProductReadyForSave(
  readiness: {
    categoryCount: number;
    imageCount: number;
    variantCount: number;
  },
) {
  const blockers: string[] = [];
  if (readiness.categoryCount <= 0) {
    blockers.push('assign at least one category');
  }
  if (readiness.imageCount <= 0) {
    blockers.push('add at least one product image');
  }
  if (readiness.variantCount <= 0) {
    blockers.push('add at least one variant with color name, color hex, and price');
  }

  if (blockers.length > 0) {
    throw new Error(
      `Product cannot be saved until ready. Please ${blockers.join(', ')}.`,
    );
  }
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

function buildVariantImagePathsByIndex<
  TVariant extends { imageSelection: string },
>(
  variants: TVariant[],
  storagePathByOrderKey: Map<string, string>,
) {
  return variants.map((variant) =>
    getVariantImagePaths(
      variant.imageSelection,
      storagePathByOrderKey,
    ),
  );
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
  let images: Awaited<ReturnType<typeof saveProductImages>> = [];

  try {
    images = await saveProductImages(
      formData,
      getProductStorageFolder(productId),
      payload.slug,
    );
    const storagePathByOrderKey = new Map<string, string>();

    images.forEach((image) => {
      storagePathByOrderKey.set(`new:${image.clientId}`, image.storagePath);
    });
    ensureProductReadyForSave({
      categoryCount: payload.categoryIds.length,
      imageCount: images.length,
      variantCount: variants.length,
    });
    const variantImagePathsByIndex = buildVariantImagePathsByIndex(
      variants,
      storagePathByOrderKey,
    );

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
            colorHex: variant.colorHex,
            size: variant.size,
            imagePath: variantImagePaths[0] ?? null,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
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
        if (offer.isActive && requestedVariantIds.length === 0) {
          throw new Error(
            'Active bundle offers must include at least one explicitly selected saved variant.',
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
        if (requestedVariantIds.length > 0) {
          await tx.productBundleOfferVariant.createMany({
            data: requestedVariantIds.map((variantId) => ({
              bundleOfferId: createdOffer.id,
              variantId,
            })),
            skipDuplicates: true,
          });
        }
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
  revalidateStorefrontProduct(productId);
  return {
    productId,
    redirectTo: `/admin/products/${productId}/edit`,
  };
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
          color: { not: null },
          colorHex: { not: null },
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
  const removedImageStoragePaths = removedImages.map((image) => image.storagePath);

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

  let newImages: Awaited<ReturnType<typeof saveProductImages>> = [];

  try {
    newImages = shouldSaveProductMedia
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
    const projectedImageCount = shouldSaveProductMedia
      ? existingImages.length + newImages.length
      : await prisma.productImage.count({
          where: { productId },
        });
    assertProductImageCountAllowed(projectedImageCount);
    const projectedCategoryCount = shouldSaveProductMedia
      ? payload.categoryIds.length
      : await prisma.productCategory.count({
          where: { productId },
        });
    ensureProductReadyForSave({
      categoryCount: projectedCategoryCount,
      imageCount: projectedImageCount,
      variantCount: persistedVariantCount,
    });
    const variantImagePathsByIndex = shouldSaveVariants
      ? buildVariantImagePathsByIndex(variants, storagePathByOrderKey)
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
          const updated = await tx.productSpecification.updateMany({
            where: {
              id: specification.id,
              productId,
            },
            data,
          });
          if (updated.count === 0) {
            throw new Error('Invalid product specification reference.');
          }
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

      if (removedImageStoragePaths.length > 0) {
        await tx.productVariantImage.deleteMany({
          where: {
            imagePath: { in: removedImageStoragePaths },
            variant: { productId },
          },
        });
        await tx.productVariant.updateMany({
          where: {
            imagePath: { in: removedImageStoragePaths },
            productId,
          },
          data: { imagePath: null },
        });
        await tx.productBundleOffer.updateMany({
          where: {
            imagePath: { in: removedImageStoragePaths },
            productId,
          },
          data: { imagePath: null },
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
        const existingStoragePaths = new Set(
          (
            await tx.productImage.findMany({
              where: { productId },
              select: { storagePath: true },
            })
          ).map((image) => image.storagePath),
        );
        const pendingStoragePaths = new Set<string>();
        const imagesToCreate = normalizedImageOrder.flatMap((orderItem) => {
          if (!orderItem.startsWith('new:')) return [];
          const image = newImageByClientId.get(orderItem.slice(4));
          const normalizedIndex = orderIndexByKey.get(orderItem);
          if (!image) return [];
          if (typeof normalizedIndex !== 'number') return [];
          if (existingStoragePaths.has(image.storagePath)) return [];
          if (pendingStoragePaths.has(image.storagePath)) return [];
          pendingStoragePaths.add(image.storagePath);

          return [
            {
              productId,
              storagePath: image.storagePath,
              altText: image.altText,
              isPrimary: normalizedIndex === 0,
              sortOrder: normalizedIndex,
            },
          ];
        });

        if (imagesToCreate.length > 0) {
          await tx.productImage.createMany({
            data: imagesToCreate,
          });
        }
      }
    }

      if (shouldSaveVariants) {
        for (const variantId of variantIdsToRemove) {
          const orderReferenceCount = await tx.orderProduct.count({
            where: {
              variantId,
              variant: { productId },
            },
          });

          if (orderReferenceCount === 0) {
            await tx.productBundleOfferVariant.deleteMany({
              where: {
                variantId,
                variant: { productId },
              },
            });
            await tx.productVariant.deleteMany({
              where: {
                id: variantId,
                productId,
              },
            });
            continue;
          }

          await tx.productVariant.updateMany({
            where: {
              id: variantId,
              productId,
            },
            data: { isActive: false },
          });
          await tx.productBundleOfferVariant.deleteMany({
            where: {
              variantId,
              variant: { productId },
            },
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
          colorHex: variant.colorHex,
          size: variant.size,
          imagePath: (variantImagePathsByIndex[index] ?? [])[0] ?? null,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          isActive: variant.isActive,
        };

        if (variant.id) {
          const updated = await tx.productVariant.updateMany({
            where: {
              id: variant.id,
              productId,
            },
            data,
          });
          if (updated.count === 0) {
            throw new Error('Invalid product variant reference.');
          }
          variantIdBySelectionKey.set(`existing:${variant.id}`, variant.id);
          const variantImagePaths = variantImagePathsByIndex[index] ?? [];
          await tx.productVariantImage.deleteMany({
            where: {
              variantId: variant.id,
              variant: { productId },
            },
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
          if (offer.isActive && requestedVariantIds.length === 0) {
            throw new Error(
              'Active bundle offers must include at least one valid variant.',
            );
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
            ? offer.id
            : (
                await tx.productBundleOffer.create({
                  data: {
                    ...data,
                    productId,
                  },
                  select: { id: true },
                })
              ).id;
          if (offer.id) {
            const updated = await tx.productBundleOffer.updateMany({
              where: {
                id: offer.id,
                productId,
              },
              data,
            });
            if (updated.count === 0) {
              throw new Error('Invalid product bundle offer reference.');
            }
          }

          await tx.productBundleOfferVariant.deleteMany({
            where: {
              bundleOfferId,
              bundleOffer: { productId },
            },
          });
          if (requestedVariantIds.length > 0) {
            await tx.productBundleOfferVariant.createMany({
              data: requestedVariantIds.map((variantId) => ({
                bundleOfferId,
                variantId,
              })),
              skipDuplicates: true,
            });
          }
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
        if (offer.isActive && requestedVariantIds.length === 0) {
          throw new Error(
            'Active bundle offers must include at least one valid variant.',
          );
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
          ? offer.id
          : (
              await tx.productBundleOffer.create({
                data: {
                  ...data,
                  productId,
                },
                select: { id: true },
              })
            ).id;
        if (offer.id) {
          const updated = await tx.productBundleOffer.updateMany({
            where: {
              id: offer.id,
              productId,
            },
            data,
          });
          if (updated.count === 0) {
            throw new Error('Invalid product bundle offer reference.');
          }
        }

        await tx.productBundleOfferVariant.deleteMany({
          where: {
            bundleOfferId,
            bundleOffer: { productId },
          },
        });
        if (requestedVariantIds.length > 0) {
          await tx.productBundleOfferVariant.createMany({
            data: requestedVariantIds.map((variantId) => ({
              bundleOfferId,
              variantId,
            })),
            skipDuplicates: true,
          });
        }
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
  } catch (error) {
    if (newImages.length > 0) {
      await deleteProductImageFilesBestEffort(
        newImages.map((image) => image.storagePath),
      );
    }
    throw error;
  }

  await deleteProductImageFilesBestEffort(removedImageStoragePaths);

  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidateStorefrontProduct(productId);
  redirect(`/admin/products/${productId}/edit`);
}


type ProductsBulkActionState = {
  error: string | null;
  message: string | null;
  appliedCount: number;
  skipped: Array<{
    id: string;
    name: string;
    reasons: string[];
  }>;
};

const INITIAL_PRODUCTS_BULK_ACTION_STATE: ProductsBulkActionState = {
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
        description: true,
        categories: { select: { categoryId: true }, take: 1 },
        images: { select: { id: true }, take: 1 },
        variants: {
          select: { id: true },
          take: 1,
          where: {
            color: { not: null },
            colorHex: { not: null },
          },
        },
      },
    });

    const skipped = selected
      .map((product) => {
        const reasons: string[] = [];
        if (!product.description?.trim()) reasons.push('Missing description');
        if (product.categories.length === 0) reasons.push('Missing category');
        if (product.images.length === 0) reasons.push('Missing image');
        if (product.variants.length === 0) {
          reasons.push('Missing complete variant');
        }
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

  if (bulkAction === 'delete') {
    const selected = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        images: {
          select: {
            storagePath: true,
          },
        },
        _count: {
          select: {
            orderProducts: true,
          },
        },
      },
    });

    const skipped = selected
      .map((product) => ({
        id: product.id,
        name: product.name,
        reasons:
          product._count.orderProducts > 0
            ? ['Product has order history; archive it instead']
            : [],
      }))
      .filter((item) => item.reasons.length > 0);
    const skippedIds = new Set(skipped.map((item) => item.id));
    const deletable = selected.filter((product) => !skippedIds.has(product.id));
    const deletedImagePaths: string[] = [];
    let deletedCount = 0;

    for (const product of deletable) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.bundleOfferVariant.deleteMany({
            where: {
              variant: {
                productId: product.id,
              },
            },
          });
          await tx.product.delete({
            where: { id: product.id },
          });
        });
        deletedImagePaths.push(...product.images.map((image) => image.storagePath));
        deletedCount += 1;
      } catch {
        skipped.push({
          id: product.id,
          name: product.name,
          reasons: ['Product is referenced by another record; archive it instead'],
        });
      }
    }

    await deleteProductImageFilesBestEffort(deletedImagePaths);
    revalidatePath('/admin/products');
    revalidatePath('/api/storefront/catalog');
    revalidatePath('/products');
    return {
      error: null,
      message:
        skipped.length > 0
          ? `Deleted ${deletedCount} products. Skipped ${skipped.length}.`
          : `Deleted ${deletedCount} products.`,
      appliedCount: deletedCount,
      skipped,
    };
  }

  return {
    ...INITIAL_PRODUCTS_BULK_ACTION_STATE,
    error: 'Unsupported bulk action.',
  };
}
