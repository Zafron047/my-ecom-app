'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

const HOMEPAGE_SECTION_SOURCE_TYPES = [
  'latest',
  'super_sale',
  'category',
  'tag',
] as const;
type HomepageSectionSourceType = (typeof HOMEPAGE_SECTION_SOURCE_TYPES)[number];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSourceType(value: string) {
  return HOMEPAGE_SECTION_SOURCE_TYPES.includes(value as HomepageSectionSourceType)
    ? (value as HomepageSectionSourceType)
    : 'latest';
}

function parseVariant(value: string) {
  return value === 'sale' ? 'sale' : 'default';
}

function parseLayout(value: string) {
  return value === 'carousel' ? 'carousel' : 'grid';
}

function revalidateHomepageSectionPaths() {
  revalidatePath('/admin/settings/homepage-sections');
  revalidatePath('/');
}

function getHomepageSectionDelegate() {
  const delegate = (prisma as { homepageSection?: unknown }).homepageSection as
    | {
        create: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
        delete: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  if (!delegate) {
    throw new Error(
      'Homepage section model is unavailable. Run `npx prisma generate` and restart the server.',
    );
  }

  return delegate;
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createHomepageSection(formData: FormData) {
  await requireAdminRole('/admin/settings/homepage-sections', ['admin']);

  const title = getString(formData, 'title');
  if (!title) {
    throw new Error('Section title is required.');
  }

  const selectedProductIds = getStringList(formData, 'productIds');
  const homepageSection = getHomepageSectionDelegate();
  const ctaLabel = getString(formData, 'ctaLabel');
  const ctaSlug = slugify(title);
  const ctaHref = ctaLabel && ctaSlug ? `/collections/${ctaSlug}` : null;
  const sourceType = parseSourceType(getString(formData, 'sourceType'));
  const sourceValue = getString(formData, 'sourceValue');
  const variant = parseVariant(getString(formData, 'variant'));
  const layout = parseLayout(getString(formData, 'layout'));

  await homepageSection.create({
    data: {
      title,
      eyebrow: getString(formData, 'eyebrow') || null,
      variant,
      layout,
      sourceType,
      sourceValue: sourceValue || null,
      productLimit: parsePositiveInt(getString(formData, 'productLimit'), 6),
      displayOrder: parsePositiveInt(getString(formData, 'displayOrder'), 1),
      ctaLabel: ctaLabel || null,
      ctaHref,
      isActive: formData.get('isActive') === 'on',
      products: selectedProductIds.length
        ? {
            createMany: {
              data: selectedProductIds.map((productId) => ({ productId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  revalidateHomepageSectionPaths();
}

export async function updateHomepageSection(formData: FormData) {
  await requireAdminRole('/admin/settings/homepage-sections', ['admin']);

  const sectionId = getString(formData, 'sectionId');
  if (!sectionId) {
    throw new Error('Section id is required.');
  }

  const title = getString(formData, 'title');
  if (!title) {
    throw new Error('Section title is required.');
  }

  const selectedProductIds = getStringList(formData, 'productIds');
  const homepageSection = getHomepageSectionDelegate();
  const ctaLabel = getString(formData, 'ctaLabel');
  const ctaSlug = slugify(title);
  const ctaHref = ctaLabel && ctaSlug ? `/collections/${ctaSlug}` : null;
  const sourceType = parseSourceType(getString(formData, 'sourceType'));
  const sourceValue = getString(formData, 'sourceValue');
  const variant = parseVariant(getString(formData, 'variant'));
  const layout = parseLayout(getString(formData, 'layout'));

  await prisma.$transaction(async (tx) => {
    await tx.homepageSectionProduct.deleteMany({
      where: { homepageSectionId: sectionId },
    });

    if (selectedProductIds.length > 0) {
      await tx.homepageSectionProduct.createMany({
        data: selectedProductIds.map((productId) => ({
          homepageSectionId: sectionId,
          productId,
        })),
        skipDuplicates: true,
      });
    }

    await homepageSection.update({
    where: {
      id: sectionId,
    },
    data: {
      title,
      eyebrow: getString(formData, 'eyebrow') || null,
      variant,
      layout,
      sourceType,
      sourceValue: sourceValue || null,
      productLimit: parsePositiveInt(getString(formData, 'productLimit'), 6),
      ctaLabel: ctaLabel || null,
      ctaHref,
      isActive: formData.get('isActive') === 'on',
    },
  });
  });

  revalidateHomepageSectionPaths();
}

export async function moveHomepageSection(formData: FormData) {
  await requireAdminRole('/admin/settings/homepage-sections', ['admin']);
  const sectionId = getString(formData, 'sectionId');
  const direction = getString(formData, 'direction');
  if (!sectionId) throw new Error('Section id is required.');
  if (direction !== 'up' && direction !== 'down') {
    throw new Error('Direction must be up or down.');
  }

  const sections = await prisma.homepageSection.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, displayOrder: true },
  });

  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  if (currentIndex < 0) return;
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= sections.length) return;

  const current = sections[currentIndex];
  const target = sections[targetIndex];

  await prisma.$transaction([
    prisma.homepageSection.update({
      where: { id: current.id },
      data: { displayOrder: target.displayOrder },
    }),
    prisma.homepageSection.update({
      where: { id: target.id },
      data: { displayOrder: current.displayOrder },
    }),
  ]);

  revalidateHomepageSectionPaths();
}

export async function reorderHomepageSections(formData: FormData) {
  await requireAdminRole('/admin/settings/homepage-sections', ['admin']);
  const orderedIds = getStringList(formData, 'orderedSectionIds');
  if (orderedIds.length === 0) return;

  await prisma.$transaction(
    orderedIds.map((sectionId, index) =>
      prisma.homepageSection.update({
        where: { id: sectionId },
        data: { displayOrder: index + 1 },
      }),
    ),
  );

  revalidateHomepageSectionPaths();
}

export async function deleteHomepageSection(formData: FormData) {
  await requireAdminRole('/admin/settings/homepage-sections', ['admin']);

  const sectionId = getString(formData, 'sectionId');
  if (!sectionId) {
    throw new Error('Section id is required.');
  }
  const homepageSection = getHomepageSectionDelegate();

  await homepageSection.delete({
    where: {
      id: sectionId,
    },
  });

  revalidateHomepageSectionPaths();
}
