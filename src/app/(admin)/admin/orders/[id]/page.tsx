import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type OrderDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatMoney(value: { toNumber: () => number }) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(value.toNumber());
}

export default async function AdminOrderDetailsPage({
  params,
}: OrderDetailsPageProps) {
  const { id } = await params;
  await requireAdminPermission(`/admin/orders/${id}`, 'orders.read');

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          variant: {
            select: {
              id: true,
              color: true,
              size: true,
              sku: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Order
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {order.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Placed {order.placedAt.toLocaleString()}
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back To Orders
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</p>
          <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
            {order.status}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Payment</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {order.paymentMethod}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {formatMoney(order.totalAmount)}
          </p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Customer</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>
              {[order.firstName, order.lastName].filter(Boolean).join(' ') || '-'}
            </p>
            <p>{order.phone}</p>
            <p>{order.email || '-'}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Delivery</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>{[order.address, order.thana, order.district, order.division].join(', ')}</p>
            <p>Receiver: {order.receiverPhone}</p>
            {order.notes ? <p>Note: {order.notes}</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Items</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.products.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 text-slate-800">{item.productName}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {(item.variant.color || 'Standard') + ' / ' + (item.variant.size || 'Standard')}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{item.sku}</td>
                  <td className="px-3 py-3 text-right font-medium text-slate-900">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {formatMoney(item.discountAmount)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
