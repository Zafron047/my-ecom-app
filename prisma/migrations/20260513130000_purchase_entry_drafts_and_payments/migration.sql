ALTER TABLE "PurchaseEntry"
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'due',
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paymentReference" TEXT;

ALTER TABLE "PurchaseEntry"
  ALTER COLUMN "status" SET DEFAULT 'draft';

UPDATE "PurchaseEntry"
SET "receivedAt" = "purchaseDate"
WHERE "status" = 'received';

ALTER TABLE "PurchaseEntryLine"
  ADD COLUMN "productId" TEXT;

UPDATE "PurchaseEntryLine" AS "line"
SET "productId" = "variant"."productId"
FROM "ProductVariant" AS "variant"
WHERE "line"."variantId" = "variant"."id";

ALTER TABLE "PurchaseEntryLine"
  DROP CONSTRAINT "PurchaseEntryLine_variantId_fkey";

ALTER TABLE "PurchaseEntryLine"
  ALTER COLUMN "variantId" DROP NOT NULL,
  ALTER COLUMN "batchNumber" DROP NOT NULL,
  ALTER COLUMN "unitCost" DROP NOT NULL,
  ALTER COLUMN "lineTotal" DROP NOT NULL;

CREATE INDEX "PurchaseEntry_paymentStatus_createdAt_idx"
  ON "PurchaseEntry"("paymentStatus", "createdAt");

CREATE INDEX "PurchaseEntryLine_productId_idx"
  ON "PurchaseEntryLine"("productId");

ALTER TABLE "PurchaseEntryLine"
  ADD CONSTRAINT "PurchaseEntryLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseEntryLine"
  ADD CONSTRAINT "PurchaseEntryLine_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
