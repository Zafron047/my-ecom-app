import BundleOfferManager from '@/components/admin/BundleOfferManager';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { createBundleOffer, updateBundleOffer } from './actions';

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function formatDateInput(value: Date | null) {
  if (!value) return '';
  const offset = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function decimalToString(value: { toString: () => string }) {
  return value.toString();
}

export default async function AdminProductsBundlesPage() {
  await requireAdminPermission('/admin/products/bundles', 'productCatalog.read');

  const [bundleOffers, variants] = await Promise.all([
    prisma.bundleOffer.findMany({
      select: {
        description: true,
        discountPercent: true,
        endsAt: true,
        id: true,
        imagePath: true,
        isActive: true,
        minTotalQty: true,
        startsAt: true,
        title: true,
        updatedAt: true,
        variants: {
          select: {
            variantId: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
      take: 100,
    }),
    prisma.productVariant.findMany({
      orderBy: [
        { product: { name: 'asc' } },
        { sortOrder: 'asc' },
        { sku: 'asc' },
      ],
      select: {
        color: true,
        id: true,
        imagePath: true,
        product: {
          select: {
            images: {
              orderBy: [
                { isPrimary: 'desc' },
                { sortOrder: 'asc' },
              ],
              select: {
                storagePath: true,
              },
              take: 1,
            },
            name: true,
          },
        },
        size: true,
        sku: true,
        variantImages: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            imagePath: true,
          },
          take: 1,
        },
      },
      where: {
        isActive: true,
        product: {
          status: { not: 'archived' },
        },
      },
    }),
  ]);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <BundleOfferManager
        createAction={createBundleOffer}
        updateAction={updateBundleOffer}
        bundleOffers={bundleOffers.map((bundle) => ({
          description: bundle.description,
          discountPercent: decimalToString(bundle.discountPercent),
          endsAt: formatDateInput(bundle.endsAt),
          id: bundle.id,
          imagePath: bundle.imagePath,
          isActive: bundle.isActive,
          minTotalQty: bundle.minTotalQty.toString(),
          startsAt: formatDateInput(bundle.startsAt),
          title: bundle.title,
          updatedAtLabel: formatDate(bundle.updatedAt),
          variantIds: bundle.variants.map((variant) => variant.variantId),
        }))}
        variants={variants.map((variant) => ({
          color: variant.color,
          id: variant.id,
          imagePath:
            variant.variantImages[0]?.imagePath ??
            variant.imagePath ??
            variant.product.images[0]?.storagePath ??
            null,
          productName: variant.product.name,
          size: variant.size,
          sku: variant.sku,
        }))}
      />
    </section>
  );
}
