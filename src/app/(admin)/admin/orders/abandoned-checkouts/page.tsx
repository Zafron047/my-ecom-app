import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type AbandonedCheckoutItem = {
  name?: string;
  variantLabel?: string | null;
  quantity?: number;
  lineSubtotal?: number;
};

export default async function AdminOrdersAbandonedCheckoutsPage() {
  await requireAdminPermission(
    '/admin/orders/abandoned-checkouts',
    'orders.read',
  );

  const checkouts = await prisma.abandonedCheckout.findMany({
    orderBy: [{ lastActivityAt: 'desc' }],
    take: 100,
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Abandoned Checkouts</h2>
          <p className="mt-2 text-sm text-slate-600">
            Recent cart activity recorded before checkout completion.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {checkouts.length} records
        </span>
      </div>

      {checkouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No abandoned checkout activity recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Items</th>
                <th className="px-3 py-3">Subtotal</th>
                <th className="px-3 py-3">Last Activity</th>
                <th className="px-3 py-3">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkouts.map((checkout) => {
                const items = Array.isArray(checkout.items)
                  ? (checkout.items as AbandonedCheckoutItem[])
                  : [];
                return (
                  <tr key={checkout.id} className="align-top">
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                        {checkout.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {checkout.itemCount} item{checkout.itemCount === 1 ? '' : 's'}
                      </div>
                      <div className="mt-1 max-w-md space-y-1 text-xs text-slate-500">
                        {items.slice(0, 3).map((item, index) => (
                          <p key={`${checkout.id}-${index}`} className="line-clamp-1">
                            {item.quantity ?? 1} x {item.name ?? 'Product'}
                            {item.variantLabel ? ` (${item.variantLabel})` : ''}
                          </p>
                        ))}
                        {items.length > 3 && <p>+{items.length - 3} more</p>}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      ৳{checkout.subtotalEstimate.toNumber().toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {checkout.lastActivityAt.toLocaleString('en-BD', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {checkout.sessionId.slice(0, 12)}...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

