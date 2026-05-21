ALTER TABLE "BusinessProfile"
ADD COLUMN "bannerUrl" TEXT,
ADD COLUMN "bannerAlt" TEXT;

CREATE TABLE "BusinessImage" (
    "id" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "title" TEXT,
    "altText" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessImage_imageType_isActive_displayOrder_idx" ON "BusinessImage"("imageType", "isActive", "displayOrder");
CREATE INDEX "BusinessImage_createdAt_idx" ON "BusinessImage"("createdAt");
