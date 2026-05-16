ALTER TABLE "PurchaseEntry" RENAME TO "PurchaseOrder";
ALTER TABLE "PurchaseOrder" RENAME COLUMN "entryNumber" TO "orderNumber";

ALTER TABLE "PurchaseEntryLine" RENAME TO "PurchaseOrderLine";
ALTER TABLE "PurchaseOrderLine" RENAME COLUMN "purchaseEntryId" TO "purchaseOrderId";

ALTER TABLE "InventoryBatch" RENAME COLUMN "purchaseEntryLineId" TO "purchaseOrderLineId";

ALTER TABLE "PurchaseOrder" RENAME CONSTRAINT "PurchaseEntry_pkey" TO "PurchaseOrder_pkey";
ALTER TABLE "PurchaseOrderLine" RENAME CONSTRAINT "PurchaseEntryLine_pkey" TO "PurchaseOrderLine_pkey";
ALTER TABLE "PurchaseOrderLine" RENAME CONSTRAINT "PurchaseEntryLine_purchaseEntryId_fkey" TO "PurchaseOrderLine_purchaseOrderId_fkey";
ALTER TABLE "PurchaseOrderLine" RENAME CONSTRAINT "PurchaseEntryLine_productId_fkey" TO "PurchaseOrderLine_productId_fkey";
ALTER TABLE "PurchaseOrderLine" RENAME CONSTRAINT "PurchaseEntryLine_variantId_fkey" TO "PurchaseOrderLine_variantId_fkey";
ALTER TABLE "InventoryBatch" RENAME CONSTRAINT "InventoryBatch_purchaseEntryLineId_fkey" TO "InventoryBatch_purchaseOrderLineId_fkey";

ALTER INDEX "PurchaseEntry_entryNumber_key" RENAME TO "PurchaseOrder_orderNumber_key";
ALTER INDEX "PurchaseEntry_purchaseDate_idx" RENAME TO "PurchaseOrder_purchaseDate_idx";
ALTER INDEX "PurchaseEntry_status_createdAt_idx" RENAME TO "PurchaseOrder_status_createdAt_idx";
ALTER INDEX "PurchaseEntry_paymentStatus_createdAt_idx" RENAME TO "PurchaseOrder_paymentStatus_createdAt_idx";
ALTER INDEX "PurchaseEntryLine_batchNumber_key" RENAME TO "PurchaseOrderLine_batchNumber_key";
ALTER INDEX "PurchaseEntryLine_purchaseEntryId_idx" RENAME TO "PurchaseOrderLine_purchaseOrderId_idx";
ALTER INDEX "PurchaseEntryLine_productId_idx" RENAME TO "PurchaseOrderLine_productId_idx";
ALTER INDEX "PurchaseEntryLine_variantId_idx" RENAME TO "PurchaseOrderLine_variantId_idx";
ALTER INDEX "InventoryBatch_purchaseEntryLineId_key" RENAME TO "InventoryBatch_purchaseOrderLineId_key";
