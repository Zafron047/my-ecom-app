'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

export type BundleOfferFormState = {
  archivedAt?: number;
  archivedBundleId?: string;
  error: string | null;
  savedAt?: number;
  success?: string | null;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function revalidateBundlePaths() {
  revalidateTag('storefront-catalog', 'max');
  revalidateTag('storefront-products', 'max');
  revalidatePath('/admin/products/bundles');
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/api/storefront/catalog');
}

function getVariantIds(formData: FormData) {
  return getString(formData, 'variantIds')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parsePositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a whole number greater than zero.`);
  }
  return parsed;
}

function parsePercent(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
    throw new Error('Discount percent must be between 0 and 100.');
  }
  return value;
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Schedule date is invalid.');
  }
  return parsed;
}

async function getBundlePayload(formData: FormData) {
  const title = getString(formData, 'title');
  if (!title) {
    throw new Error('Bundle title is required.');
  }

  const variantIds = getVariantIds(formData);
  if (getBoolean(formData, 'isActive') && variantIds.length === 0) {
    throw new Error('Active bundle offers must include at least one variant.');
  }

  const activeVariants = await prisma.productVariant.findMany({
    select: { id: true },
    where: {
      id: { in: variantIds },
      isActive: true,
      product: {
        status: { not: 'archived' },
      },
    },
  });
  const validVariantIds = activeVariants.map((variant) => variant.id);

  if (getBoolean(formData, 'isActive') && validVariantIds.length === 0) {
    throw new Error('Active bundle offers must include at least one active variant.');
  }

  return {
    description: getOptionalString(formData, 'description'),
    discountPercent: parsePercent(getString(formData, 'discountPercent')),
    endsAt: parseOptionalDate(getString(formData, 'endsAt')),
    imagePath: getOptionalString(formData, 'imagePath'),
    isActive: getBoolean(formData, 'isActive'),
    minTotalQty: parsePositiveInt(getString(formData, 'minTotalQty'), 'Minimum quantity'),
    startsAt: parseOptionalDate(getString(formData, 'startsAt')),
    title,
    variantIds: validVariantIds,
  };
}

export async function createBundleOffer(
  _previousState: BundleOfferFormState,
  formData: FormData,
): Promise<BundleOfferFormState> {
  await requireAdminPermission('/admin/products/bundles', 'productCatalog.manage');

  try {
    const payload = await getBundlePayload(formData);
    const maxSort = await prisma.bundleOffer.aggregate({
      _max: { sortOrder: true },
    });

    await prisma.bundleOffer.create({
      data: {
        description: payload.description,
        discountPercent: payload.discountPercent,
        endsAt: payload.endsAt,
        imagePath: payload.imagePath,
        isActive: payload.isActive,
        minTotalQty: payload.minTotalQty,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        startsAt: payload.startsAt,
        title: payload.title,
        variants: {
          createMany: {
            data: payload.variantIds.map((variantId) => ({ variantId })),
            skipDuplicates: true,
          },
        },
      },
    });

    revalidateBundlePaths();

    return {
      error: null,
      savedAt: Date.now(),
      success: 'Bundle offer created.',
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to create bundle offer.',
    };
  }
}

export async function updateBundleOffer(
  _previousState: BundleOfferFormState,
  formData: FormData,
): Promise<BundleOfferFormState> {
  await requireAdminPermission('/admin/products/bundles', 'productCatalog.manage');

  const bundleId = getString(formData, 'bundleId');
  const intent = getString(formData, 'intent') || 'save';
  if (!bundleId) {
    return { error: 'Bundle offer could not be found.' };
  }

  const existing = await prisma.bundleOffer.findUnique({
    select: { id: true },
    where: { id: bundleId },
  });
  if (!existing) {
    return { error: 'Bundle offer could not be found.' };
  }

  if (intent === 'archive') {
    await prisma.bundleOffer.update({
      data: { isActive: false },
      where: { id: bundleId },
    });
    revalidateBundlePaths();
    return {
      archivedAt: Date.now(),
      archivedBundleId: bundleId,
      error: null,
      success: 'Bundle offer archived.',
    };
  }

  if (intent === 'delete') {
    await prisma.bundleOffer.delete({
      where: { id: bundleId },
    });
    revalidateBundlePaths();
    return {
      archivedAt: Date.now(),
      archivedBundleId: bundleId,
      error: null,
      success: 'Bundle offer deleted.',
    };
  }

  try {
    const payload = await getBundlePayload(formData);
    await prisma.$transaction(async (tx) => {
      await tx.bundleOffer.update({
        data: {
          description: payload.description,
          discountPercent: payload.discountPercent,
          endsAt: payload.endsAt,
          imagePath: payload.imagePath,
          isActive: payload.isActive,
          minTotalQty: payload.minTotalQty,
          startsAt: payload.startsAt,
          title: payload.title,
        },
        where: { id: bundleId },
      });
      await tx.bundleOfferVariant.deleteMany({
        where: { bundleOfferId: bundleId },
      });
      if (payload.variantIds.length > 0) {
        await tx.bundleOfferVariant.createMany({
          data: payload.variantIds.map((variantId) => ({
            bundleOfferId: bundleId,
            variantId,
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidateBundlePaths();

    return {
      error: null,
      savedAt: Date.now(),
      success: 'Bundle offer saved.',
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save bundle offer.',
    };
  }
}
