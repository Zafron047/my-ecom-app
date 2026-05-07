ALTER TABLE "Product" DROP COLUMN IF EXISTS "bundleQty1";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "bundlePrice1";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "bundleQty2";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "bundlePrice2";

CREATE TABLE "ProductBundleOffer" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT,
  "imagePath" TEXT,
  "minTotalQty" INTEGER NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductBundleOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductBundleOfferVariant" (
  "bundleOfferId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductBundleOfferVariant_pkey" PRIMARY KEY ("bundleOfferId", "variantId")
);

CREATE INDEX "ProductBundleOffer_productId_sortOrder_idx" ON "ProductBundleOffer"("productId", "sortOrder");
CREATE INDEX "ProductBundleOffer_productId_isActive_idx" ON "ProductBundleOffer"("productId", "isActive");
CREATE INDEX "ProductBundleOfferVariant_variantId_idx" ON "ProductBundleOfferVariant"("variantId");

ALTER TABLE "ProductBundleOffer" ADD CONSTRAINT "ProductBundleOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleOfferVariant" ADD CONSTRAINT "ProductBundleOfferVariant_bundleOfferId_fkey" FOREIGN KEY ("bundleOfferId") REFERENCES "ProductBundleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleOfferVariant" ADD CONSTRAINT "ProductBundleOfferVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
