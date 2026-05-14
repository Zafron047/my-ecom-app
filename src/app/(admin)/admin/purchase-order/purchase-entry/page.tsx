import PurchaseEntryForm from '@/components/admin/PurchaseEntryForm';
import PurchaseEntryRecentEntries from '@/components/admin/PurchaseEntryRecentEntries';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import {
  discardPurchaseEntryDraft,
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

function formatDate(value: Date) {
  return value.toLocaleDateString('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDecimalInput(value: { toString: () => string } | null | undefined) {
  return value?.toString() ?? null;
}

function formatVariantLabel(variant: {
  color: string | null;
  size: string | null;
}) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard';
}

type PurchaseEntryPageProps = {
  searchParams: Promise<{ draftId?: string | string[] }>;
};

export default async function AdminPurchaseOrderPurchaseEntryPage({
  searchParams,
}: PurchaseEntryPageProps) {
  await requireAdminPermission(
    '/admin/purchase-order/purchase-entry',
    'products.read',
  );

  const query = await searchParams;
  const selectedDraftId =
    typeof query.draftId === 'string' ? query.draftId : null;

  const [variants, initialDraft, recentEntries] = await Promise.all([
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
            paymentMethod: true,
            paymentReference: true,
            paymentStatus: true,
            purchaseDate: true,
            referenceNo: true,
            supplierName: true,
          },
          where: {
            id: selectedDraftId,
            status: 'draft',
          },
        })
      : Promise.resolve(null),
    prisma.purchaseEntry.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        entryNumber: true,
        paymentMethod: true,
        paymentReference: true,
        paymentStatus: true,
        lines: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            batchNumber: true,
            lineTotal: true,
            product: {
              select: {
                name: true,
              },
            },
            quantity: true,
            unitCost: true,
            variant: {
              select: {
                color: true,
                size: true,
                sku: true,
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        purchaseDate: true,
        status: true,
        supplierName: true,
        totalCost: true,
        totalQuantity: true,
      },
      take: 10,
      where: {
        status: { not: 'draft' },
      },
    }),
  ]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">New Purchase Entry</h2>
        <p className="mt-1 text-sm text-slate-600">
          Save a draft, then submit it as an official purchase record before payment or receiving starts.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PurchaseEntryForm
          discardDraftAction={discardPurchaseEntryDraft}
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
                  paymentMethod: initialDraft.paymentMethod ?? '',
                  paymentReference: initialDraft.paymentReference ?? '',
                  paymentStatus: initialDraft.paymentStatus,
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Recent Purchase Entries
        </h3>
        <PurchaseEntryRecentEntries
          entries={recentEntries.map((entry) => ({
            entryNumber: entry.entryNumber,
            lines: entry.lines.map((line) => ({
              batchNumber: line.batchNumber ?? '-',
              lineTotal: formatMoney(line.lineTotal) ?? '-',
              productName: line.variant?.product.name ?? line.product?.name ?? '-',
              quantity: line.quantity,
              sku: line.variant?.sku ?? '-',
              unitCost: formatMoney(line.unitCost) ?? '-',
              variantLabel: line.variant ? formatVariantLabel(line.variant) : 'Select variant',
            })),
            paymentMethod: entry.paymentMethod,
            paymentReference: entry.paymentReference,
            paymentStatus: entry.paymentStatus,
            purchaseDate: formatDate(entry.purchaseDate),
            status: entry.status,
            supplierName: entry.supplierName,
            totalCost: formatMoney(entry.totalCost) ?? '-',
            totalQuantity: entry.totalQuantity,
          }))}
        />
      </section>
    </section>
  );
}
