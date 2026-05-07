import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminProductsPoPage() {
  await requireAdminPermission('/admin/products/po', 'products.read');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">P/O</h2>
      <p className="mt-2 text-sm text-slate-600">
        Purchase order workflow scaffolded.
      </p>
    </section>
  );
}

