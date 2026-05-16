import PurchaseEntryListPage from '../_components/PurchaseEntryListPage';

export default function AdminPurchaseOrderClosedPage() {
  return (
    <PurchaseEntryListPage
      description="Showing all closed POs."
      pathname="/admin/purchase-order/closed"
      title="Closed POs"
      view="closed"
    />
  );
}
