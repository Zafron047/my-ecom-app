import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminAccountingPlPage() {
  await requireAdminPermission('/admin/accounting/pl', 'accounting.read');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">P/L</h2>
      <p className="mt-2 text-sm text-slate-600">
        Profit and loss reporting scaffolded.
      </p>
    </section>
  );
}

