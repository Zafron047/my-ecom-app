CREATE TABLE "PurchaseOrderNote" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderNote_purchaseOrderId_createdAt_idx" ON "PurchaseOrderNote"("purchaseOrderId", "createdAt");
CREATE INDEX "PurchaseOrderNote_createdByAdminId_idx" ON "PurchaseOrderNote"("createdByAdminId");

ALTER TABLE "PurchaseOrderNote" ADD CONSTRAINT "PurchaseOrderNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderNote" ADD CONSTRAINT "PurchaseOrderNote_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
