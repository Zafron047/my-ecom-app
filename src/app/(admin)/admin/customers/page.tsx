import { CustomerType } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
};

const customerTypes = Object.values(CustomerType);

function getCustomerType(value: string | undefined) {
  return customerTypes.includes(value as CustomerType)
    ? (value as CustomerType)
    : undefined;
}

function formatMoney(value: { toNumber: () => number } | number | null | undefined) {
  const amount =
    typeof value === 'number' ? value : value?.toNumber ? value.toNumber() : 0;

  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

export default async function AdminCustomersPage({
  searchParams,
}: CustomersPageProps) {
  await requireAdminPermission('/admin/customers', 'customers.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const customerType = getCustomerType(params.type);

  const customers = await prisma.customer.findMany({
    include: {
      orders: {
        orderBy: {
          placedAt: 'desc',
        },
        select: {
          placedAt: true,
          totalAmount: true,
        },
        take: 1,
      },
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 50,
    where: {
      ...(customerType ? { customerType } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Customers</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review contact details, customer type, risk status, and order history
          signals.
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search name, email, or phone"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
        <select
          name="type"
          defaultValue={customerType ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        >
          <option value="">All types</option>
          {customerTypes.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
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
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2 text-right">Orders</th>
              <th className="px-3 py-2 text-right">Last Order</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.length > 0 ? (
              customers.map((customer) => {
                const lastOrder = customer.orders[0];

                return (
                  <tr key={customer.id} className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">
                        {[customer.firstName, customer.lastName]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-xs text-slate-500">{customer.phone}</p>
                      {customer.email && (
                        <p className="text-xs text-slate-500">{customer.email}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700">
                        {customer.customerType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <p>{customer.identifierTag.replaceAll('_', ' ')}</p>
                      {customer.behaviorTags.length > 0 && (
                        <p className="mt-1">
                          {customer.behaviorTags
                            .map((tag) => tag.replaceAll('_', ' '))
                            .join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {customer._count.orders}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {lastOrder ? formatMoney(lastOrder.totalAmount) : 'None'}
                      {lastOrder && (
                        <p className="text-xs text-slate-500">
                          {lastOrder.placedAt.toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          customer.isBlocked
                            ? 'bg-red-50 text-red-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {customer.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                  No customers match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
