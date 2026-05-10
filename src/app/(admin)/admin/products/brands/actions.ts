'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

export type BrandFormState = {
  archivedAt?: number;
  archivedBrandId?: string;
  error: string | null;
  savedAt?: number;
  savedSnapshot?: string;
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getBrandSnapshot(formData: FormData, slug: string) {
  return JSON.stringify({
    description: getOptionalString(formData, 'description') ?? '',
    isActive: getBoolean(formData, 'isActive'),
    name: getString(formData, 'name'),
    slug,
  });
}

export async function createBrand(
  _previousState: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  await requireAdminPermission('/admin/products/brands', 'products.write');

  const name = getString(formData, 'name');
  if (!name) {
    return { error: 'Brand name is required.' };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: 'Brand name must include letters or numbers.' };
  }

  const existingBrand = await prisma.brand.findUnique({
    select: { id: true },
    where: { slug },
  });

  if (existingBrand) {
    return { error: 'A brand with this name already exists.' };
  }

  await prisma.brand.create({
    data: {
      description: getOptionalString(formData, 'description'),
      isActive: getBoolean(formData, 'isActive'),
      name,
      slug,
    },
  });

  revalidatePath('/admin/products/brands');
  revalidatePath('/admin/products/new');

  return {
    error: null,
    savedAt: Date.now(),
    savedSnapshot: JSON.stringify({
      description: '',
      isActive: true,
      name: '',
      slug: '',
    }),
    success: 'Brand created.',
  };
}

export async function updateBrand(
  _previousState: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  await requireAdminPermission('/admin/products/brands', 'products.write');

  const brandId = getString(formData, 'brandId');
  const intent = getString(formData, 'intent') || 'save';
  if (!brandId) {
    return { error: 'Brand could not be found.' };
  }

  const brand = await prisma.brand.findUnique({
    select: { id: true },
    where: { id: brandId },
  });

  if (!brand) {
    return { error: 'Brand could not be found.' };
  }

  if (intent === 'archive') {
    await prisma.brand.update({
      data: { isActive: false },
      where: { id: brandId },
    });

    revalidatePath('/admin/products/brands');
    revalidatePath('/admin/products/new');

    return {
      archivedAt: Date.now(),
      archivedBrandId: brandId,
      error: null,
      success: 'Brand archived.',
    };
  }

  const name = getString(formData, 'name');
  if (!name) {
    return { error: 'Brand name is required.' };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: 'Brand name must include letters or numbers.' };
  }

  const existingBrand = await prisma.brand.findUnique({
    select: { id: true },
    where: { slug },
  });

  if (existingBrand && existingBrand.id !== brandId) {
    return { error: 'A brand with this name already exists.' };
  }

  await prisma.brand.update({
    data: {
      description: getOptionalString(formData, 'description'),
      isActive: getBoolean(formData, 'isActive'),
      name,
      slug,
    },
    where: { id: brandId },
  });

  revalidatePath('/admin/products/brands');
  revalidatePath('/admin/products/new');

  return {
    error: null,
    savedAt: Date.now(),
    savedSnapshot: getBrandSnapshot(formData, slug),
    success: 'Brand saved.',
  };
}
