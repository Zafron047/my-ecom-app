import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminOrdersAbandonedCheckoutsPage() {
  await requireAdminPermission(
    '/admin/orders/abandoned-checkouts',
    'orders.read',
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Abandoned Checkouts</h2>
      <p className="mt-2 text-sm text-slate-600">
        Recovery queue scaffolded for abandoned customer checkout attempts.
      </p>
    </section>
  );
}

