-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'INSURANCE_AUTO', 'OTHER');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Document_ownerId_category_idx" ON "Document"("ownerId", "category");
