CREATE TABLE "CustomerPasswordResetToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPasswordResetToken_tokenHash_key" ON "CustomerPasswordResetToken"("tokenHash");

CREATE INDEX "CustomerPasswordResetToken_customerId_expiresAt_idx" ON "CustomerPasswordResetToken"("customerId", "expiresAt");

CREATE INDEX "CustomerPasswordResetToken_expiresAt_idx" ON "CustomerPasswordResetToken"("expiresAt");

ALTER TABLE "CustomerPasswordResetToken" ADD CONSTRAINT "CustomerPasswordResetToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
