CREATE TABLE "PurchaseOrderEvent" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderEvent_purchaseOrderId_createdAt_idx" ON "PurchaseOrderEvent"("purchaseOrderId", "createdAt");
CREATE INDEX "PurchaseOrderEvent_createdByAdminId_idx" ON "PurchaseOrderEvent"("createdByAdminId");
CREATE INDEX "PurchaseOrderEvent_eventType_createdAt_idx" ON "PurchaseOrderEvent"("eventType", "createdAt");

ALTER TABLE "PurchaseOrderEvent" ADD CONSTRAINT "PurchaseOrderEvent_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderEvent" ADD CONSTRAINT "PurchaseOrderEvent_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
