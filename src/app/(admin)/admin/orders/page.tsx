import Link from 'next/link';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { formatSalesOrderStatusLabel } from '@/lib/sales-order-status';

type OrdersPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

const orderStatuses = Object.values(OrderStatus);

const statusStyles: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  processing: 'bg-indigo-50 text-indigo-700',
  onHold: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-50 text-red-700',
  shipped: 'bg-cyan-50 text-cyan-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  returned: 'bg-orange-50 text-orange-700',
};

function getStatus(value: string | undefined) {
  return orderStatuses.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : undefined;
}

function formatMoney(value: { toNumber: () => number }) {
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value.toNumber());
}

function formatPaymentMethod(value: PaymentMethod) {
  return value === PaymentMethod.COD ? 'COD' : 'bKash';
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  await requireAdminPermission('/admin/orders', 'orders.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = getStatus(params.status);

  const orders = await prisma.order.findMany({
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
      products: {
        select: {
          id: true,
          quantity: true,
        },
      },
      orderReturns: {
        select: {
          lines: {
            select: {
              orderProductId: true,
              quantity: true,
            },
          },
        },
      },
    },
    orderBy: {
      placedAt: 'desc',
    },
    take: 50,
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { orderNumber: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
              { receiverPhone: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Orders</h2>
          <p className="mt-1 text-sm text-slate-600">
            Track status, customer contact, payment method, and fulfillment load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/orders/pos"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            POS
          </Link>
          <Link
            href="/admin/orders/drafts"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Drafts
          </Link>
        </div>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search order, customer, or phone"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        >
          <option value="">All statuses</option>
          {orderStatuses.map((item) => (
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
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2 text-right">Items</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length > 0 ? (
              orders.map((order) => {
                const orderedQuantity = order.products.reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                );
                const returnedQuantity = order.orderReturns.reduce(
                  (sum, orderReturn) =>
                    sum +
                    orderReturn.lines.reduce(
                      (lineSum, line) => lineSum + line.quantity,
                      0,
                    ),
                  0,
                );
                const isPartialReturn =
                  returnedQuantity > 0 && returnedQuantity < orderedQuantity;
                const statusLabel = isPartialReturn
                  ? 'Partial return'
                  : formatSalesOrderStatusLabel(order.status);
                const statusClass = isPartialReturn
                  ? statusStyles.returned
                  : statusStyles[order.status];

                return (
                <tr key={order.id} className="align-top transition hover:bg-slate-50">
                  <td className="relative px-3 py-3 font-medium text-slate-900">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="absolute inset-0"
                      aria-label={`View details for order ${order.orderNumber}`}
                    />
                    {order.orderNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <p>
                      {[order.firstName, order.lastName].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-xs text-slate-500">{order.phone}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {formatPaymentMethod(order.paymentMethod)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600">
                    {order._count.products}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(order.totalAmount)}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {order.placedAt.toLocaleString()}
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                  No orders match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
