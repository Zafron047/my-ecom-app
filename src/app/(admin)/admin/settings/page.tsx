import { requireAdminRole } from '@/lib/admin-session';
import Link from 'next/link';

export default async function AdminSettingsPage() {
  await requireAdminRole('/admin/settings', ['admin']);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Admin-only settings workspace. Use this area to manage access and
          operational controls.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Access Control</h3>
        <p className="mt-2 text-sm text-slate-600">
          Manage admin roles and account status from one place.
        </p>
        <Link
          href="/admin/settings/manage-roles"
          className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Open Manage Roles
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Homepage Merchandising</h3>
        <p className="mt-2 text-sm text-slate-600">
          Configure homepage product list sections and their serial order.
        </p>
        <Link
          href="/admin/settings/homepage-sections"
          className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Open Homepage Sections
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Backup</h3>
        <p className="mt-2 text-sm text-slate-600">
          Download snapshot backups from a single admin-only place.
        </p>
        <Link
          href="/admin/settings/backup"
          className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Open Backup
        </Link>
      </div>
    </section>
  );
}
