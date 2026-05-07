import Link from 'next/link';
import { requireAdminRole } from '@/lib/admin-session';
import BackupRestoreForm from '@/components/admin/BackupRestoreForm';
import CatalogQaForm from '@/components/admin/CatalogQaForm';

export default async function AdminBackupSettingsPage() {
  await requireAdminRole('/admin/settings/backup', ['admin']);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Backup</h2>
        <p className="mt-2 text-sm text-slate-600">
          Download product catalog snapshot files for backup and recovery.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">Full Catalog Snapshot</h3>
        <p className="mt-1 text-sm text-slate-600">
          Exports one row per variant with parent product details, so full item
          structure can be restored.
        </p>
        <Link
          href="/api/admin/products/export"
          className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Download Full Catalog CSV
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">Restore from CSV</h3>
        <p className="mt-1 text-sm text-slate-600">
          Upload full catalog CSV and restore parent products plus variants by
          variant SKU.
        </p>
        <BackupRestoreForm />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">Catalog QA Checks</h3>
        <p className="mt-1 text-sm text-slate-600">
          Scan for missing fields, duplicate SKU/slug, invalid stock values, broken
          image URLs, and draft-only products.
        </p>
        <CatalogQaForm />
      </div>
    </section>
  );
}
