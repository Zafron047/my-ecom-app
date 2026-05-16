import PurchaseOrderListPage from './_components/PurchaseOrderListPage';

export default function AdminPurchaseOrderPage() {
  return (
    <PurchaseOrderListPage
      createHref="/admin/purchase-order/draft?new=1"
      createLabel="New PO Draft"
      description="Showing all submitted purchase orders."
      pathname="/admin/purchase-order"
      title="Purchase Orders"
      view="po"
    />
  );
}

