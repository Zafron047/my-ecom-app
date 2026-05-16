import PurchaseEntryListPage from './_components/PurchaseEntryListPage';

export default function AdminPurchaseOrderPage() {
  return (
    <PurchaseEntryListPage
      createHref="/admin/purchase-order/purchase-entry?new=1"
      createLabel="New Purchase Entry"
      description="Showing all POs after purchase entries are submitted."
      pathname="/admin/purchase-order"
      title="Purchase Orders"
      view="po"
    />
  );
}

