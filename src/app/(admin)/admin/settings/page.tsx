import { requireAdminRole } from '@/lib/admin-session';

export default async function AdminSettingsPage() {
  await requireAdminRole('/admin/settings', ['owner']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
      <p className="mt-2 text-sm text-slate-600">
        Owner-only settings module scaffolded. Next step: shipping, payment, and
        operational configuration.
      </p>
    </section>
  );
}

