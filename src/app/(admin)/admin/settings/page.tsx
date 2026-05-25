import { requireAdminPermission } from '@/lib/admin-session';
import Link from 'next/link';
import { canAccessPermission } from '@/lib/admin-rbac';

export default async function AdminSettingsPage() {
  const session = await requireAdminPermission('/admin/settings', 'settings.manage');

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Manage storefront settings and operational controls.
        </p>
      </div>

      {canAccessPermission(session.role, 'adminUsers.manage') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Access Control</h3>
          <p className="mt-2 text-sm text-slate-600">
            Manage staff onboarding, roles, passwords, and sessions.
          </p>
          <Link
            href="/admin/settings/manage-roles"
            className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Open Admin Access
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Business Profile</h3>
        <p className="mt-2 text-sm text-slate-600">
          Manage logo, return refund policy, business info, and storefront metadata.
        </p>
        <Link
          href="/admin/settings/business-profile"
          className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Open Business Profile
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">UI Management</h3>
        <p className="mt-2 text-sm text-slate-600">
          Manage hero slider slides and collection entry points.
        </p>
        <Link
          href="/admin/settings/ui"
          className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Open UI Management
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

      {canAccessPermission(session.role, 'backups.manage') && (
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
      )}
    </section>
  );
}
