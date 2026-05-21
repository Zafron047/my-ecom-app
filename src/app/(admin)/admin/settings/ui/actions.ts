'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getHeroSlideDelegate() {
  const delegate = (prisma as { heroSlide?: unknown }).heroSlide as
    | {
        create: (args: unknown) => Promise<unknown>;
        delete: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  if (!delegate) {
    throw new Error(
      'Hero slide model is unavailable. Run `npx prisma generate` and restart the server.',
    );
  }

  return delegate;
}

function revalidateUiPaths() {
  revalidateTag('storefront-hero-slides', 'max');
  revalidatePath('/');
  revalidatePath('/api/storefront/catalog');
  revalidatePath('/admin/settings/ui');
}

export async function createHeroSlide(formData: FormData) {
  await requireAdminRole('/admin/settings/ui', ['admin']);

  const title = getString(formData, 'title');
  const imageUrl = getString(formData, 'imageUrl');
  if (!title) throw new Error('Slide title is required.');
  if (!imageUrl) throw new Error('Slide image URL is required.');

  const heroSlide = getHeroSlideDelegate();
  await heroSlide.create({
    data: {
      ctaHref: optionalString(formData, 'ctaHref'),
      ctaLabel: optionalString(formData, 'ctaLabel'),
      displayOrder: parsePositiveInt(getString(formData, 'displayOrder'), 1),
      imageUrl,
      isActive: formData.get('isActive') === 'on',
      secondaryHref: optionalString(formData, 'secondaryHref'),
      secondaryLabel: optionalString(formData, 'secondaryLabel'),
      subtitle: optionalString(formData, 'subtitle'),
      title,
    },
  });

  revalidateUiPaths();
}

export async function updateHeroSlide(formData: FormData) {
  await requireAdminRole('/admin/settings/ui', ['admin']);

  const slideId = getString(formData, 'slideId');
  const intent = getString(formData, 'intent') || 'save';
  if (!slideId) throw new Error('Slide id is required.');

  const heroSlide = getHeroSlideDelegate();
  if (intent === 'delete') {
    await heroSlide.delete({ where: { id: slideId } });
    revalidateUiPaths();
    return;
  }

  const title = getString(formData, 'title');
  const imageUrl = getString(formData, 'imageUrl');
  if (!title) throw new Error('Slide title is required.');
  if (!imageUrl) throw new Error('Slide image URL is required.');

  await heroSlide.update({
    data: {
      ctaHref: optionalString(formData, 'ctaHref'),
      ctaLabel: optionalString(formData, 'ctaLabel'),
      displayOrder: parsePositiveInt(getString(formData, 'displayOrder'), 1),
      imageUrl,
      isActive: formData.get('isActive') === 'on',
      secondaryHref: optionalString(formData, 'secondaryHref'),
      secondaryLabel: optionalString(formData, 'secondaryLabel'),
      subtitle: optionalString(formData, 'subtitle'),
      title,
    },
    where: { id: slideId },
  });

  revalidateUiPaths();
}
