-- CreateTable
CREATE TABLE "DeliveryDivision" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDistrict" (
    "id" TEXT NOT NULL,
    "redxId" INTEGER NOT NULL,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryArea" (
    "id" TEXT NOT NULL,
    "redxId" INTEGER NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postCode" INTEGER,
    "redxZoneId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDivision_name_key" ON "DeliveryDivision"("name");

-- CreateIndex
CREATE INDEX "DeliveryDivision_isActive_name_idx" ON "DeliveryDivision"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDistrict_redxId_key" ON "DeliveryDistrict"("redxId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDistrict_divisionId_name_key" ON "DeliveryDistrict"("divisionId", "name");

-- CreateIndex
CREATE INDEX "DeliveryDistrict_divisionId_isActive_name_idx" ON "DeliveryDistrict"("divisionId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryArea_redxId_key" ON "DeliveryArea"("redxId");

-- CreateIndex
CREATE INDEX "DeliveryArea_districtId_isActive_name_idx" ON "DeliveryArea"("districtId", "isActive", "name");

-- CreateIndex
CREATE INDEX "DeliveryArea_postCode_idx" ON "DeliveryArea"("postCode");

-- CreateIndex
CREATE INDEX "DeliveryArea_redxZoneId_idx" ON "DeliveryArea"("redxZoneId");

-- AddForeignKey
ALTER TABLE "DeliveryDistrict" ADD CONSTRAINT "DeliveryDistrict_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "DeliveryDivision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryArea" ADD CONSTRAINT "DeliveryArea_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "DeliveryDistrict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
