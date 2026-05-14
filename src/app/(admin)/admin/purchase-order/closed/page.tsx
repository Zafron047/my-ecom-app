import PurchaseEntryListPage from '../_components/PurchaseEntryListPage';

export default function AdminPurchaseOrderClosedPage() {
  return (
    <PurchaseEntryListPage
      description="Showing all closed purchase entries, including fully received, short closed, cancelled, and legacy received entries."
      pathname="/admin/purchase-order/closed"
      title="Closed"
      view="closed"
    />
  );
}
