import { OrderStatus } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { businessData } from '@/lib/business-data';
import { prisma } from '@/lib/prisma';

function formatMoney(value: { toNumber: () => number } | number | null | undefined) {
  const amount =
    typeof value === 'number' ? value : value?.toNumber ? value.toNumber() : 0;

  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

export default async function AdminDashboardPage() {
  await requireAdminPermission('/admin', 'dashboard.read');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    ordersToday,
    pendingFulfillment,
    revenueToday,
    lowStockAlerts,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        placedAt: {
          gte: startOfToday,
        },
      },
    }),
    prisma.order.count({
      where: {
        status: {
          in: [OrderStatus.pending, OrderStatus.confirmed, OrderStatus.processing],
        },
      },
    }),
    prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        placedAt: {
          gte: startOfToday,
        },
        status: {
          notIn: [OrderStatus.cancelled, OrderStatus.returned],
        },
      },
    }),
    prisma.productVariant.count({
      where: {
        isActive: true,
        stockQuantity: {
          lte: 10,
        },
      },
    }),
    prisma.order.findMany({
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: {
        placedAt: 'desc',
      },
      take: 5,
    }),
  ]);

  const stats = [
    { label: 'Orders Today', value: ordersToday.toString() },
    { label: 'Pending Fulfillment', value: pendingFulfillment.toString() },
    { label: 'Revenue Today', value: formatMoney(revenueToday._sum.totalAmount) },
    { label: 'Low Stock Alerts', value: lowStockAlerts.toString() },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-600">
          Central operations overview for {businessData.name}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {stat.value}
            </p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Recent Orders
          </h3>
          <p className="text-sm text-slate-600">
            Latest customer activity across the storefront.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>
                        {[order.customer.firstName, order.customer.lastName]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.customer.phone}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold capitalize text-blue-700">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(order.totalAmount)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {order.placedAt.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                    No orders have been placed yet.
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
