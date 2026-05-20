CREATE TABLE "OrderReturn" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "reason" TEXT,
  "refundAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "createdByAdminId" TEXT,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderReturnLine" (
  "id" TEXT NOT NULL,
  "orderReturnId" TEXT NOT NULL,
  "orderProductId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "restocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderReturnLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderReturn_orderId_createdAt_idx" ON "OrderReturn"("orderId", "createdAt");
CREATE INDEX "OrderReturn_createdByAdminId_idx" ON "OrderReturn"("createdByAdminId");
CREATE INDEX "OrderReturnLine_orderReturnId_idx" ON "OrderReturnLine"("orderReturnId");
CREATE INDEX "OrderReturnLine_orderProductId_idx" ON "OrderReturnLine"("orderProductId");

ALTER TABLE "OrderReturn"
  ADD CONSTRAINT "OrderReturn_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderReturn"
  ADD CONSTRAINT "OrderReturn_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderReturnLine"
  ADD CONSTRAINT "OrderReturnLine_orderReturnId_fkey"
  FOREIGN KEY ("orderReturnId") REFERENCES "OrderReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderReturnLine"
  ADD CONSTRAINT "OrderReturnLine_orderProductId_fkey"
  FOREIGN KEY ("orderProductId") REFERENCES "OrderProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
