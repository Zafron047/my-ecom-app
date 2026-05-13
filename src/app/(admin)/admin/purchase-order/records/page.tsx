import PurchaseEntryListPage from '../_components/PurchaseEntryListPage';

export default function AdminPurchaseOrderRecordsPage() {
  return (
    <PurchaseEntryListPage
      description="Review official purchase records, payment state, and receiving progress."
      pathname="/admin/purchase-order/records"
      status="records"
      title="Records"
    />
  );
}
