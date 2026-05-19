import Link from 'next/link';
import { redirect } from 'next/navigation';
import CustomerPasswordChangeForm from '@/components/CustomerPasswordChangeForm';
import CustomerSessionManagementForm from '@/components/CustomerSessionManagementForm';
import { getCustomerSession } from '@/lib/customer-session';
import { prisma } from '@/lib/prisma';

function formatMoney(value: { toNumber: () => number }) {
  return `Tk ${value.toNumber().toLocaleString('en-BD', {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

const statusStyles: Record<string, string> = {
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  onHold: 'border-slate-200 bg-slate-50 text-slate-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  processing: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  returned: 'border-orange-200 bg-orange-50 text-orange-700',
  shipped: 'border-cyan-200 bg-cyan-50 text-cyan-700',
};

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect('/login?next=/account');
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: {
      address: true,
      district: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      thana: true,
      division: true,
      orders: {
        orderBy: { placedAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          status: true,
          totalAmount: true,
          _count: {
            select: { products: true },
          },
        },
        take: 20,
      },
    },
  });

  if (!customer) {
    redirect('/login?next=/account');
  }

  const customerName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(' ');
  const addressLines = [
    customer.address,
    [customer.thana, customer.district].filter(Boolean).join(', '),
    customer.division ? `${customer.division}, Bangladesh` : '',
  ].filter(Boolean);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
            My Account
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {customerName || 'Customer'}
          </h1>
        </div>
        <Link
          href="/products"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Continue shopping
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </dt>
                <dd className="mt-1 text-slate-900">{customerName || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </dt>
                <dd className="mt-1 text-slate-900">{customer.phone}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </dt>
                <dd className="mt-1 text-slate-900">{customer.email || '-'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Saved Delivery Details
            </h2>
            {addressLines.length > 0 ? (
              <div className="mt-4 space-y-1 text-sm leading-6 text-slate-700">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No saved delivery address yet.
              </p>
            )}
          </section>

          <CustomerPasswordChangeForm />

          <CustomerSessionManagementForm />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Order History</h2>
            <span className="text-sm text-slate-500">
              {customer.orders.length} recent orders
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Items</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.orders.length > 0 ? (
                  customer.orders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        <Link
                          href={`/order-confirmation?orderId=${encodeURIComponent(
                            order.orderNumber,
                          )}`}
                          className="text-blue-700 transition hover:text-blue-900"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[order.status] ?? statusStyles.pending
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {order._count.products}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">
                        {formatMoney(order.totalAmount)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDate(order.placedAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
