import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminAccountingExpensesPage() {
  await requireAdminPermission('/admin/accounting/expenses', 'accounting.read');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Expenses</h2>
      <p className="mt-2 text-sm text-slate-600">
        Expense tracking module scaffolded.
      </p>
    </section>
  );
}

