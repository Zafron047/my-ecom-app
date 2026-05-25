import { requireAdminPermission } from '@/lib/admin-session';

export default async function AdminOrdersDeliveryOptionsPage() {
  await requireAdminPermission(
    '/admin/orders/delivery-options',
    'deliveryOptions.manage',
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Delivery Options</h2>
      <p className="mt-2 text-sm text-slate-600">
        Delivery configuration scaffolded for logistics and fulfillment methods.
      </p>
    </section>
  );
}

