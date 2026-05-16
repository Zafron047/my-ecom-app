import PurchaseOrderListPage from '../_components/PurchaseOrderListPage';

export default function AdminPurchaseOrderClosedPage() {
  return (
    <PurchaseOrderListPage
      description="Showing all closed POs."
      pathname="/admin/purchase-order/closed"
      title="Closed POs"
      view="closed"
    />
  );
}
