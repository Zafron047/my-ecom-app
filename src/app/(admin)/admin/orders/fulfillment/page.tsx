import { SupplierFulfillmentStatus } from '@prisma/client';
import Link from 'next/link';
import { requireAdminPermission } from '@/lib/admin-session';
import { BDBUY_SUPPLIER_KEY } from '@/lib/supplier-fulfillment';
import { prisma } from '@/lib/prisma';
import { retryBDBuyFulfillmentOrder } from './actions';

type FulfillmentPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

type FulfillmentRequestPayload = {
  items?: Array<{
    name?: string;
    quantity?: number;
  }>;
  totals?: {
    total?: number;
  };
};

const statuses = Object.values(SupplierFulfillmentStatus);

const statusStyles: Record<SupplierFulfillmentStatus, string> = {
  accepted: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-700',
  failed: 'bg-red-50 text-red-700',
  pending: 'bg-amber-50 text-amber-700',
  sent: 'bg-blue-50 text-blue-700',
};

function getStatus(value: string | undefined) {
  return statuses.includes(value as SupplierFulfillmentStatus)
    ? (value as SupplierFulfillmentStatus)
    : undefined;
}

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value ?? 0);
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleString() : '-';
}

export default async function AdminFulfillmentOrdersPage({
  searchParams,
}: FulfillmentPageProps) {
  await requireAdminPermission('/admin/orders/fulfillment', 'orders.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = getStatus(params.status);

  const fulfillments = await prisma.supplierFulfillmentOrder.findMany({
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          firstName: true,
          lastName: true,
          phone: true,
          totalAmount: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
    where: {
      supplier: BDBUY_SUPPLIER_KEY,
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { localOrderNumber: { contains: query, mode: 'insensitive' } },
              { supplierOrderNumber: { contains: query, mode: 'insensitive' } },
              {
                order: {
                  OR: [
                    { firstName: { contains: query, mode: 'insensitive' } },
                    { lastName: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
  });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            BDBuy Fulfillment Orders
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Orders created in WoWMall and sent to BDBuy for fulfillment.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          All Orders
        </Link>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search order, supplier order, customer, or phone"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">WoWMall Order</th>
              <th className="px-3 py-2">BDBuy Order</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fulfillments.length > 0 ? (
              fulfillments.map((fulfillment) => {
                const requestPayload =
                  fulfillment.requestPayload as FulfillmentRequestPayload;
                const itemCount =
                  requestPayload.items?.reduce(
                    (sum, item) => sum + Math.max(1, Math.floor(item.quantity ?? 1)),
                    0,
                  ) ?? 0;
                const firstItemName = requestPayload.items?.[0]?.name ?? '';

                return (
                  <tr key={fulfillment.id} className="align-top transition hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/orders/${fulfillment.order.id}`}
                        className="font-semibold text-slate-900 underline-offset-4 hover:underline"
                      >
                        {fulfillment.localOrderNumber}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {fulfillment.createdAt.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-700">
                      {fulfillment.supplierOrderNumber ?? '-'}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>
                        {[fulfillment.order.firstName, fulfillment.order.lastName]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-xs text-slate-500">{fulfillment.order.phone}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>{itemCount} pcs</p>
                      {firstItemName ? (
                        <p className="max-w-56 truncate text-xs text-slate-500">
                          {firstItemName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(requestPayload.totals?.total)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${statusStyles[fulfillment.status]}`}
                      >
                        {fulfillment.status}
                      </span>
                      {fulfillment.lastError ? (
                        <p className="mt-1 max-w-64 text-xs text-red-600">
                          {fulfillment.lastError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <p>{formatDate(fulfillment.sentAt)}</p>
                      <p className="mt-1">Attempts: {fulfillment.attemptCount}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {fulfillment.status === SupplierFulfillmentStatus.failed ? (
                        <form action={retryBDBuyFulfillmentOrder}>
                          <input
                            type="hidden"
                            name="fulfillmentOrderId"
                            value={fulfillment.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            Retry
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                  No BDBuy fulfillment orders match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
