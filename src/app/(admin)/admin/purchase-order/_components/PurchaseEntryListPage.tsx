import Link from 'next/link';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import {
  CLOSED_PURCHASE_ENTRY_STATUSES,
  PURCHASE_ENTRY_STATUS,
  PURCHASE_PAYMENT_STATUS,
  formatPurchasePaymentStatus,
  getPurchaseEntryLifecycleLabel,
  getPurchaseEntryReceivingStatus,
  shouldShowInClosedPurchaseOrderList,
  shouldShowInOpenPurchaseOrderList,
} from '@/lib/purchase-order-status';

type PurchaseEntryListPageProps = {
  createHref?: string;
  createLabel?: string;
  description: string;
  pathname: string;
  view: 'closed' | 'entry' | 'po';
  title: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CREATE_BUTTON_CLASS =
  'inline-flex h-10 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold !text-white shadow-sm shadow-blue-900/10 transition hover:bg-blue-600 hover:!text-white visited:!text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

function formatMoney(value: { toNumber: () => number } | null | undefined) {
  if (!value) return '-';
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value.toNumber());
}

function formatMoneyNumber(value: number) {
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusTone(statusLabel: string) {
  if (statusLabel === 'Purchase Entry') return 'bg-amber-50 text-amber-700';
  if (statusLabel === 'Cancelled' || statusLabel === 'Closed Short') {
    return 'bg-rose-50 text-rose-700';
  }
  if (statusLabel === 'Open') return 'bg-blue-50 text-blue-700';
  return 'bg-emerald-50 text-emerald-700';
}

function isUntouchedForThirtyDays(updatedAt: Date) {
  return Date.now() - updatedAt.getTime() >= THIRTY_DAYS_MS;
}

function getEntryWhere(view: PurchaseEntryListPageProps['view']) {
  if (view === 'entry') {
    return {
      status: PURCHASE_ENTRY_STATUS.DRAFT,
    };
  }

  if (view === 'closed') {
    return {
      OR: [
        { status: { in: [...CLOSED_PURCHASE_ENTRY_STATUSES] } },
        { paymentStatus: PURCHASE_PAYMENT_STATUS.PAID },
      ],
    };
  }

  return {
    status: {
      not: PURCHASE_ENTRY_STATUS.DRAFT,
    },
  };
}

function getEmptyMessage(view: PurchaseEntryListPageProps['view']) {
  if (view === 'entry') return 'No purchase entries found.';
  if (view === 'closed') return 'No closed POs found.';
  return 'No POs found.';
}

export default async function PurchaseEntryListPage({
  createHref,
  createLabel = 'New Purchase Entry',
  description,
  pathname,
  title,
  view,
}: PurchaseEntryListPageProps) {
  await requireAdminPermission(pathname, 'products.read');
  const isPurchaseEntryView = view === 'entry';

  const entries = await prisma.purchaseEntry.findMany({
    orderBy: isPurchaseEntryView
      ? [{ updatedAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      createdAt: true,
      entryNumber: true,
      id: true,
      lines: {
        select: {
          batch: {
            select: {
              receivedQuantity: true,
            },
          },
          quantity: true,
        },
      },
      paymentMethod: true,
      paidAmount: true,
      paymentStatus: true,
      purchaseDate: true,
      status: true,
      supplierName: true,
      totalCost: true,
      totalQuantity: true,
      updatedAt: true,
    },
    where: getEntryWhere(view),
  });
  const visibleEntries = entries.filter((entry) => {
    const receivedQuantity = entry.lines.reduce(
      (sum, line) => sum + (line.batch?.receivedQuantity ?? 0),
      0,
    );
    const lifecycleInput = {
      paymentStatus: entry.paymentStatus,
      receivedQuantity,
      status: entry.status,
      totalQuantity: entry.totalQuantity,
    };

    if (view === 'closed') {
      return shouldShowInClosedPurchaseOrderList(lifecycleInput);
    }
    if (view === 'po') {
      return shouldShowInOpenPurchaseOrderList(lifecycleInput);
    }
    return true;
  });

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          {createHref ? (
            <Link
              href={createHref}
              className={CREATE_BUTTON_CLASS}
            >
              {createLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Entry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Receiving</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {getEmptyMessage(view)}
                  </td>
                </tr>
              ) : (
                visibleEntries.map((entry) => {
                  const receivedQuantity = entry.lines.reduce(
                    (sum, line) => sum + (line.batch?.receivedQuantity ?? 0),
                    0,
                  );
                  const isStale = isUntouchedForThirtyDays(entry.updatedAt);
                  const statusLabel = getPurchaseEntryLifecycleLabel({
                    paymentStatus: entry.paymentStatus,
                    receivedQuantity,
                    status: entry.status,
                    totalQuantity: entry.totalQuantity,
                  });
                  const actionHref =
                    isPurchaseEntryView
                      ? `/admin/purchase-order/purchase-entry?entryId=${entry.id}`
                      : `/admin/purchase-order/records/${entry.id}`;

                  return (
                    <tr key={entry.id} className="align-top transition hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {entry.entryNumber}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {isPurchaseEntryView
                            ? `Updated ${formatDate(entry.updatedAt)}`
                            : formatDate(entry.purchaseDate)}
                        </div>
                        {isStale ? (
                          <div className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            30+ days untouched
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${getStatusTone(
                            statusLabel,
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {entry.supplierName || '-'}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {formatPurchasePaymentStatus(entry.paymentStatus)}
                        </div>
                        <div className="text-xs capitalize text-slate-500">
                          {entry.paymentMethod || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {getPurchaseEntryReceivingStatus(
                          entry.totalQuantity,
                          receivedQuantity,
                        )}
                        <div className="text-xs text-slate-500">
                          {receivedQuantity} received /{' '}
                          {Math.max(0, entry.totalQuantity - receivedQuantity)} left
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {entry.totalQuantity}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        <div>{formatMoney(entry.totalCost)}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {formatMoney(entry.paidAmount)} paid /{' '}
                          {formatMoneyNumber(
                            Math.max(
                              0,
                              entry.totalCost.toNumber() -
                                entry.paidAmount.toNumber(),
                            ),
                          )}{' '}
                          due
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={actionHref}
                          className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {isPurchaseEntryView ? 'Open Entry' : 'Open PO'}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
