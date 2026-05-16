ALTER TABLE "PurchaseEntry"
  ADD COLUMN "paidAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "PurchaseEntry"
SET "paidAmount" = "totalCost"
WHERE "paymentStatus" = 'paid';
