CREATE TYPE "SupplierFulfillmentStatus" AS ENUM ('pending', 'sent', 'failed', 'accepted', 'cancelled');

CREATE TABLE "SupplierFulfillmentOrder" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "supplier" TEXT NOT NULL,
  "status" "SupplierFulfillmentStatus" NOT NULL DEFAULT 'pending',
  "localOrderNumber" TEXT NOT NULL,
  "supplierOrderNumber" TEXT,
  "requestPayload" JSONB NOT NULL,
  "responsePayload" JSONB,
  "lastError" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierFulfillmentOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierFulfillmentOrder_orderId_idx" ON "SupplierFulfillmentOrder"("orderId");
CREATE INDEX "SupplierFulfillmentOrder_supplier_status_createdAt_idx" ON "SupplierFulfillmentOrder"("supplier", "status", "createdAt");
CREATE INDEX "SupplierFulfillmentOrder_supplierOrderNumber_idx" ON "SupplierFulfillmentOrder"("supplierOrderNumber");

ALTER TABLE "SupplierFulfillmentOrder"
  ADD CONSTRAINT "SupplierFulfillmentOrder_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
