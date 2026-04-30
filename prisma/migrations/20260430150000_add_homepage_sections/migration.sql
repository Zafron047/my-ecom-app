-- CreateEnum
CREATE TYPE "HomepageSectionVariant" AS ENUM ('default', 'sale');

-- CreateEnum
CREATE TYPE "HomepageSectionSourceType" AS ENUM ('latest', 'super_sale', 'category');

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eyebrow" TEXT,
    "variant" "HomepageSectionVariant" NOT NULL DEFAULT 'default',
    "sourceType" "HomepageSectionSourceType" NOT NULL DEFAULT 'latest',
    "sourceValue" TEXT,
    "productLimit" INTEGER NOT NULL DEFAULT 6,
    "displayOrder" INTEGER NOT NULL DEFAULT 1,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageSectionProduct" (
    "homepageSectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomepageSectionProduct_pkey" PRIMARY KEY ("homepageSectionId","productId")
);

-- CreateIndex
CREATE INDEX "HomepageSection_isActive_displayOrder_idx" ON "HomepageSection"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "HomepageSectionProduct_productId_idx" ON "HomepageSectionProduct"("productId");

-- AddForeignKey
ALTER TABLE "HomepageSectionProduct" ADD CONSTRAINT "HomepageSectionProduct_homepageSectionId_fkey" FOREIGN KEY ("homepageSectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSectionProduct" ADD CONSTRAINT "HomepageSectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
