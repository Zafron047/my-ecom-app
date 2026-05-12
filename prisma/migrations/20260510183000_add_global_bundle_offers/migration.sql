CREATE TABLE "BundleOffer" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imagePath" TEXT,
  "minTotalQty" INTEGER NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BundleOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BundleOfferVariant" (
  "bundleOfferId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BundleOfferVariant_pkey" PRIMARY KEY ("bundleOfferId", "variantId")
);

CREATE INDEX "BundleOffer_isActive_sortOrder_idx" ON "BundleOffer"("isActive", "sortOrder");
CREATE INDEX "BundleOffer_startsAt_endsAt_idx" ON "BundleOffer"("startsAt", "endsAt");
CREATE INDEX "BundleOfferVariant_variantId_idx" ON "BundleOfferVariant"("variantId");

ALTER TABLE "BundleOfferVariant" ADD CONSTRAINT "BundleOfferVariant_bundleOfferId_fkey" FOREIGN KEY ("bundleOfferId") REFERENCES "BundleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleOfferVariant" ADD CONSTRAINT "BundleOfferVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BundleOffer" (
  "id",
  "title",
  "description",
  "imagePath",
  "minTotalQty",
  "discountPercent",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  COALESCE(NULLIF(TRIM("title"), ''), 'Bundle Offer'),
  NULL,
  "imagePath",
  "minTotalQty",
  "discountPercent",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
FROM "ProductBundleOffer"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "BundleOfferVariant" ("bundleOfferId", "variantId", "assignedAt")
SELECT "bundleOfferId", "variantId", "assignedAt"
FROM "ProductBundleOfferVariant"
ON CONFLICT ("bundleOfferId", "variantId") DO NOTHING;
