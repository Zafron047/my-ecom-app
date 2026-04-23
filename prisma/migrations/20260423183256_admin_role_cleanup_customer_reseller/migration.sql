-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('retail', 'reseller');

-- AlterEnum
BEGIN;
CREATE TYPE "AdminRole_new" AS ENUM ('admin', 'manager', 'support');
ALTER TABLE "public"."AdminUser" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AdminUser" ALTER COLUMN "role" TYPE "AdminRole_new" USING ("role"::text::"AdminRole_new");
ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
ALTER TYPE "AdminRole_new" RENAME TO "AdminRole";
DROP TYPE "public"."AdminRole_old";
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'support';
COMMIT;

-- AlterTable
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'support';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "canViewStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'retail';
