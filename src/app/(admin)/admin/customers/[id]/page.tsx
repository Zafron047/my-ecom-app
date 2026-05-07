import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin-session';
import CustomerDetailsForm from '@/components/admin/CustomerDetailsForm';
import { prisma } from '@/lib/prisma';

type CustomerDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatMoney(value: { toNumber: () => number } | number) {
  const amount = typeof value === 'number' ? value : value.toNumber();
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function AdminCustomerDetailsPage({
  params,
}: CustomerDetailsPageProps) {
  const { id } = await params;
  await requireAdminPermission(`/admin/customers/${id}`, 'customers.read');

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { placedAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentMethod: true,
          totalAmount: true,
          placedAt: true,
        },
        take: 20,
      },
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!customer) notFound();

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{customer.phone}</p>
            <p className="text-sm text-slate-600">{customer.email || 'Email not provided'}</p>
          </div>
          <Link
            href="/admin/customers"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back To Customers
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Type</p>
          <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
            {customer.customerType}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Orders</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{customer._count.orders}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Identifier Tag</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {customer.identifierTag.replaceAll('_', ' ')}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {customer.isBlocked ? 'Blocked' : 'Active'}
          </p>
        </article>
      </div>

      <CustomerDetailsForm
        initialCustomer={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName ?? '',
          email: customer.email ?? '',
          phone: customer.phone,
          division: customer.division ?? '',
          district: customer.district ?? '',
          thana: customer.thana ?? '',
          address: customer.address ?? '',
          customerType: customer.customerType,
          identifierTag: customer.identifierTag,
          behaviorTags: customer.behaviorTags,
          notes: customer.notes ?? '',
          isBlocked: customer.isBlocked,
        }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Recent Orders</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customer.orders.length > 0 ? (
                customer.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 capitalize text-slate-700">{order.status}</td>
                    <td className="px-3 py-3 text-slate-700">{order.paymentMethod}</td>
                    <td className="px-3 py-3 text-right text-slate-900">
                      {formatMoney(order.totalAmount)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">
                      {order.placedAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                    No orders found for this customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
