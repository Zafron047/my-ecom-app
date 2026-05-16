import PurchaseEntryForm from '@/components/admin/PurchaseEntryForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { PURCHASE_ENTRY_STATUS } from '@/lib/purchase-order-status';
import PurchaseEntryListPage from '../_components/PurchaseEntryListPage';
import {
  recordPurchaseEntry,
  savePurchaseEntryDraft,
} from './actions';

function formatMoney(value: { toNumber: () => number } | null | undefined) {
  if (!value) return null;
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value.toNumber());
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDecimalInput(value: { toString: () => string } | null | undefined) {
  return value?.toString() ?? null;
}

type PurchaseEntryPageProps = {
  searchParams: Promise<{
    draftId?: string | string[];
    entryId?: string | string[];
    new?: string | string[];
  }>;
};

export default async function AdminPurchaseOrderPurchaseEntryPage({
  searchParams,
}: PurchaseEntryPageProps) {
  const query = await searchParams;
  const selectedEntryId =
    typeof query.entryId === 'string'
      ? query.entryId
      : typeof query.draftId === 'string'
        ? query.draftId
        : null;
  const isNewEntry =
    typeof query.new === 'string' &&
    ['1', 'true', 'yes'].includes(query.new.toLowerCase());

  if (!selectedEntryId && !isNewEntry) {
    return (
      <PurchaseEntryListPage
        createHref="/admin/purchase-order/purchase-entry?new=1"
        createLabel="New Purchase Entry"
        description="Review saved purchase entries before they become POs."
        pathname="/admin/purchase-order/purchase-entry"
        title="Purchase Entry"
        view="entry"
      />
    );
  }

  await requireAdminPermission(
    '/admin/purchase-order/purchase-entry',
    'products.read',
  );

  const [variants, initialDraft] = await Promise.all([
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
        size: true,
        sku: true,
        stockQuantity: true,
        inventoryBatches: {
          orderBy: {
            receivedAt: 'asc',
          },
          select: {
            unitCost: true,
          },
          take: 1,
          where: {
            remainingQuantity: { gt: 0 },
            status: 'available',
          },
        },
        product: {
          select: {
            id: true,
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
      },
      where: {
        isActive: true,
        product: {
          status: { not: 'archived' },
        },
      },
    }),
    selectedEntryId
      ? prisma.purchaseEntry.findFirst({
          select: {
            id: true,
            lines: {
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                id: true,
                productId: true,
                quantity: true,
                unitCost: true,
                variantId: true,
              },
            },
            notes: true,
            purchaseDate: true,
            referenceNo: true,
            supplierName: true,
          },
          where: {
            id: selectedEntryId,
            status: PURCHASE_ENTRY_STATUS.DRAFT,
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          {selectedEntryId ? 'Edit Purchase Entry' : 'New Purchase Entry'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Build the product list here, then submit it to a PO for payment and receiving.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PurchaseEntryForm
          key={initialDraft?.id ?? 'new-purchase-entry'}
          initialDraft={
            initialDraft
              ? {
                  id: initialDraft.id,
                  lines: initialDraft.lines.map((line) => ({
                    id: line.id,
                    productId: line.productId,
                    quantity: line.quantity,
                    unitCost: formatDecimalInput(line.unitCost),
                    variantId: line.variantId,
                  })),
                  notes: initialDraft.notes ?? '',
                  purchaseDate: formatDateInput(initialDraft.purchaseDate),
                  referenceNo: initialDraft.referenceNo ?? '',
                  supplierName: initialDraft.supplierName ?? '',
                }
              : null
          }
          recordAction={recordPurchaseEntry}
          saveDraftAction={savePurchaseEntryDraft}
          variants={variants.map((variant) => ({
            color: variant.color,
            currentFifoCost: formatMoney(variant.inventoryBatches[0]?.unitCost),
            id: variant.id,
            imagePath: variant.imagePath ?? variant.product.images[0]?.storagePath ?? null,
            productId: variant.product.id,
            productImage: variant.product.images[0]?.storagePath ?? null,
            productName: variant.product.name,
            size: variant.size,
            sku: variant.sku,
            stockQuantity: variant.stockQuantity,
          }))}
        />
      </section>
    </section>
  );
}
