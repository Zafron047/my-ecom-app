CREATE TABLE "AbandonedCheckout" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "items" JSONB NOT NULL,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "subtotalEstimate" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "customerName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "recoveredOrderId" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AbandonedCheckout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AbandonedCheckout_sessionId_key" ON "AbandonedCheckout"("sessionId");
CREATE INDEX "AbandonedCheckout_status_lastActivityAt_idx" ON "AbandonedCheckout"("status", "lastActivityAt");
CREATE INDEX "AbandonedCheckout_phone_idx" ON "AbandonedCheckout"("phone");
