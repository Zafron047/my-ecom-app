CREATE TABLE "PurchaseEntry" (
  "id" TEXT NOT NULL,
  "entryNumber" TEXT NOT NULL,
  "supplierName" TEXT,
  "referenceNo" TEXT,
  "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'received',
  "totalQuantity" INTEGER NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseEntryLine" (
  "id" TEXT NOT NULL,
  "purchaseEntryId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12, 2) NOT NULL,
  "lineTotal" DECIMAL(12, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseEntryLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBatch" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "purchaseEntryLineId" TEXT NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "receivedQuantity" INTEGER NOT NULL,
  "remainingQuantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12, 2) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'available',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseEntry_entryNumber_key" ON "PurchaseEntry"("entryNumber");
CREATE INDEX "PurchaseEntry_purchaseDate_idx" ON "PurchaseEntry"("purchaseDate");
CREATE INDEX "PurchaseEntry_status_createdAt_idx" ON "PurchaseEntry"("status", "createdAt");

CREATE UNIQUE INDEX "PurchaseEntryLine_batchNumber_key" ON "PurchaseEntryLine"("batchNumber");
CREATE INDEX "PurchaseEntryLine_purchaseEntryId_idx" ON "PurchaseEntryLine"("purchaseEntryId");
CREATE INDEX "PurchaseEntryLine_variantId_idx" ON "PurchaseEntryLine"("variantId");

CREATE UNIQUE INDEX "InventoryBatch_purchaseEntryLineId_key" ON "InventoryBatch"("purchaseEntryLineId");
CREATE UNIQUE INDEX "InventoryBatch_batchNumber_key" ON "InventoryBatch"("batchNumber");
CREATE INDEX "InventoryBatch_variantId_remainingQuantity_receivedAt_idx" ON "InventoryBatch"("variantId", "remainingQuantity", "receivedAt");
CREATE INDEX "InventoryBatch_status_receivedAt_idx" ON "InventoryBatch"("status", "receivedAt");

ALTER TABLE "PurchaseEntryLine"
  ADD CONSTRAINT "PurchaseEntryLine_purchaseEntryId_fkey"
  FOREIGN KEY ("purchaseEntryId") REFERENCES "PurchaseEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseEntryLine"
  ADD CONSTRAINT "PurchaseEntryLine_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryBatch"
  ADD CONSTRAINT "InventoryBatch_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryBatch"
  ADD CONSTRAINT "InventoryBatch_purchaseEntryLineId_fkey"
  FOREIGN KEY ("purchaseEntryLineId") REFERENCES "PurchaseEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
