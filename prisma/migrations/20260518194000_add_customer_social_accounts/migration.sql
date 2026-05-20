CREATE TABLE "CustomerSocialAccount" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerSocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSocialAccount_provider_providerAccountId_key"
  ON "CustomerSocialAccount"("provider", "providerAccountId");

CREATE INDEX "CustomerSocialAccount_customerId_idx"
  ON "CustomerSocialAccount"("customerId");

CREATE INDEX "CustomerSocialAccount_email_idx"
  ON "CustomerSocialAccount"("email");

ALTER TABLE "CustomerSocialAccount"
  ADD CONSTRAINT "CustomerSocialAccount_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
