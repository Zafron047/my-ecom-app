-- Add optional mobile login for admin users while keeping email as the primary identity.
ALTER TABLE "AdminUser" ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "AdminUser_phone_key" ON "AdminUser"("phone");
