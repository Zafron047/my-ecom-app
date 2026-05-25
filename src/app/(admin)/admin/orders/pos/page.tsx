import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminOrdersPosPage() {
  await requireAdminPermission('/admin/orders/pos', 'pos.manage');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">POS</h2>
      <p className="mt-2 text-sm text-slate-600">
        Point of sale workspace scaffolded for quick admin order entry.
      </p>
    </section>
  );
}

