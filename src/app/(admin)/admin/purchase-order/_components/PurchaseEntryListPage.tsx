import Link from 'next/link';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type PurchaseEntryListPageProps = {
  description: string;
  pathname: string;
  view: 'confirmed' | 'closed' | 'draft';
  title: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CLOSED_PURCHASE_ENTRY_STATUSES = [
  'cancelled',
  'closed_short',
  'full_received',
  'received',
];
const CONFIRMED_PURCHASE_ENTRY_STATUSES = ['recorded', 'partial_received'];

function formatMoney(value: { toNumber: () => number } | null | undefined) {
  if (!value) return '-';
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

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    cancelled: 'Cancelled',
    closed_short: 'Closed Short',
    draft: 'Draft',
    full_received: 'Full Received',
    partial_received: 'Partial Received',
    received: 'Received',
    recorded: 'Confirmed',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function formatPaymentStatus(status: string) {
  const labels: Record<string, string> = {
    due: 'Due',
    paid: 'Paid',
    partial_paid: 'Partially Paid',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function getStatusTone(status: string) {
  if (status === 'draft') return 'bg-amber-50 text-amber-700';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700';
  if (status === 'recorded' || status === 'partial_received') {
    return 'bg-blue-50 text-blue-700';
  }
  return 'bg-emerald-50 text-emerald-700';
}

function getReceivingStatus(totalQuantity: number, receivedQuantity: number) {
  if (receivedQuantity <= 0) return 'Not Received';
  if (receivedQuantity >= totalQuantity) return 'Full Received';
  return 'Partial Received';
}

function isUntouchedForThirtyDays(updatedAt: Date) {
  return Date.now() - updatedAt.getTime() >= THIRTY_DAYS_MS;
}

function getEntryWhere(view: PurchaseEntryListPageProps['view']) {
  if (view === 'draft') {
    return {
      status: 'draft',
    };
  }

  if (view === 'closed') {
    return {
      status: {
        in: CLOSED_PURCHASE_ENTRY_STATUSES,
      },
    };
  }

  return {
    status: {
      in: CONFIRMED_PURCHASE_ENTRY_STATUSES,
    },
  };
}

function getEmptyMessage(view: PurchaseEntryListPageProps['view']) {
  if (view === 'draft') return 'No draft purchase entries found.';
  if (view === 'closed') return 'No closed purchase entries found.';
  return 'No confirmed purchase entries found.';
}

export default async function PurchaseEntryListPage({
  description,
  pathname,
  title,
  view,
}: PurchaseEntryListPageProps) {
  await requireAdminPermission(pathname, 'products.read');
  const isDraftView = view === 'draft';

  const entries = await prisma.purchaseEntry.findMany({
    orderBy: isDraftView ? { updatedAt: 'desc' } : { purchaseDate: 'desc' },
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

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
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
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {getEmptyMessage(view)}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const receivedQuantity = entry.lines.reduce(
                    (sum, line) => sum + (line.batch?.receivedQuantity ?? 0),
                    0,
                  );
                  const isStale = isUntouchedForThirtyDays(entry.updatedAt);
                  const actionHref =
                    isDraftView
                      ? `/admin/purchase-order/purchase-entry?draftId=${entry.id}`
                      : `/admin/purchase-order/records/${entry.id}`;

                  return (
                    <tr key={entry.id} className="align-top transition hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {entry.entryNumber}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {isDraftView
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
                            entry.status,
                          )}`}
                        >
                          {formatStatus(entry.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {entry.supplierName || '-'}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {formatPaymentStatus(entry.paymentStatus)}
                        </div>
                        <div className="text-xs capitalize text-slate-500">
                          {entry.paymentMethod || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {getReceivingStatus(entry.totalQuantity, receivedQuantity)}
                        <div className="text-xs text-slate-500">
                          {receivedQuantity} received /{' '}
                          {Math.max(0, entry.totalQuantity - receivedQuantity)} left
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {entry.totalQuantity}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {formatMoney(entry.totalCost)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={actionHref}
                          className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {isDraftView ? 'Open Draft' : 'Open Record'}
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
