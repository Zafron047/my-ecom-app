ALTER TABLE "Product"
ADD COLUMN "hasActiveBundleOffer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bundleMinTotalQty" INTEGER,
ADD COLUMN "bundleDiscountPercent" DECIMAL(5,2),
ADD COLUMN "bundleDisplayText" TEXT;

CREATE TABLE "OrderNote" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");
CREATE INDEX "OrderNote_createdByAdminId_idx" ON "OrderNote"("createdByAdminId");

ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_createdByAdminId_fkey"
FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
