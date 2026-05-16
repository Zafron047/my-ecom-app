import PurchaseOrderForm from '@/components/admin/PurchaseOrderForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { PURCHASE_ORDER_STATUS } from '@/lib/purchase-order-status';
import PurchaseOrderListPage from '../_components/PurchaseOrderListPage';
import {
  savePurchaseOrderDraft,
  submitPurchaseOrder,
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

type PurchaseOrderPageProps = {
  searchParams: Promise<{
    draftId?: string | string[];
    new?: string | string[];
  }>;
};

export default async function AdminPurchaseOrderDraftPage({
  searchParams,
}: PurchaseOrderPageProps) {
  const query = await searchParams;
  const selectedDraftId = typeof query.draftId === 'string' ? query.draftId : null;
  const isNewDraft =
    typeof query.new === 'string' &&
    ['1', 'true', 'yes'].includes(query.new.toLowerCase());

  if (!selectedDraftId && !isNewDraft) {
    return (
      <PurchaseOrderListPage
        createHref="/admin/purchase-order/draft?new=1"
        createLabel="New PO Draft"
        description="Review saved PO drafts before they become purchase orders."
        pathname="/admin/purchase-order/draft"
        title="PO Draft"
        view="draft"
      />
    );
  }

  await requireAdminPermission(
    '/admin/purchase-order/draft',
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
    selectedDraftId
      ? prisma.purchaseOrder.findFirst({
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
            id: selectedDraftId,
            status: PURCHASE_ORDER_STATUS.DRAFT,
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          {selectedDraftId ? 'Edit PO Draft' : 'New PO Draft'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Build the product list here, then submit it to a PO for payment and receiving.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PurchaseOrderForm
          key={initialDraft?.id ?? 'new-purchase-order-draft'}
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
          recordAction={submitPurchaseOrder}
          saveDraftAction={savePurchaseOrderDraft}
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
