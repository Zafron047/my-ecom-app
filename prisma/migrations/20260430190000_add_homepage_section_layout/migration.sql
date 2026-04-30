-- CreateEnum
CREATE TYPE "HomepageSectionLayout" AS ENUM ('grid', 'carousel');

-- AlterTable
ALTER TABLE "HomepageSection" ADD COLUMN "layout" "HomepageSectionLayout" NOT NULL DEFAULT 'grid';
