CREATE TABLE "InventoryAllocation" (
  "id" TEXT NOT NULL,
  "orderProductId" TEXT NOT NULL,
  "inventoryBatchId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12, 2) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryAllocation_orderProductId_releasedAt_idx"
  ON "InventoryAllocation"("orderProductId", "releasedAt");

CREATE INDEX "InventoryAllocation_inventoryBatchId_idx"
  ON "InventoryAllocation"("inventoryBatchId");

CREATE INDEX "InventoryAllocation_variantId_releasedAt_idx"
  ON "InventoryAllocation"("variantId", "releasedAt");

ALTER TABLE "InventoryAllocation"
  ADD CONSTRAINT "InventoryAllocation_orderProductId_fkey"
  FOREIGN KEY ("orderProductId") REFERENCES "OrderProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAllocation"
  ADD CONSTRAINT "InventoryAllocation_inventoryBatchId_fkey"
  FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAllocation"
  ADD CONSTRAINT "InventoryAllocation_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
