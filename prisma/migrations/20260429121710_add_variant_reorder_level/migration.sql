-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "reorderLevel" INTEGER NOT NULL DEFAULT 10;

-- CreateIndex
CREATE INDEX "ProductVariant_reorderLevel_idx" ON "ProductVariant"("reorderLevel");
