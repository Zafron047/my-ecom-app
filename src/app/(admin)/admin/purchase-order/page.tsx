import PurchaseEntryListPage from './_components/PurchaseEntryListPage';

export default function AdminPurchaseOrderPage() {
  return (
    <PurchaseEntryListPage
      description="Showing all confirmed purchase entries that are still open for receiving or settlement."
      pathname="/admin/purchase-order"
      title="Purchase Orders"
      view="confirmed"
    />
  );
}

