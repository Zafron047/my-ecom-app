import PurchaseEntryListPage from '../_components/PurchaseEntryListPage';

export default function AdminPurchaseOrderDraftsPage() {
  return (
    <PurchaseEntryListPage
      description="Review saved purchase entry drafts before they become official purchase records."
      pathname="/admin/purchase-order/drafts"
      title="Drafts"
      view="draft"
    />
  );
}
