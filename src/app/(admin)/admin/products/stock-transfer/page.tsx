import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminProductsStockTransferPage() {
  await requireAdminPermission(
    '/admin/products/stock-transfer',
    'stockTransfers.manage',
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Stock Transfer</h2>
      <p className="mt-2 text-sm text-slate-600">
        Stock transfer operations scaffolded.
      </p>
    </section>
  );
}

