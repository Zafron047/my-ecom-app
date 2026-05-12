ALTER TABLE "OrderProduct"
ADD COLUMN "imagePath" TEXT,
ADD COLUMN "bundleTitle" TEXT,
ADD COLUMN "bundleRule" TEXT;

UPDATE "OrderProduct" AS op
SET "imagePath" = pv."imagePath"
FROM "ProductVariant" AS pv
WHERE op."variantId" = pv."id"
  AND op."imagePath" IS NULL;
