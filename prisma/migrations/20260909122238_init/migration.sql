/*
  Warnings:

  - You are about to drop the column `category` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `deadlineType` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `extractionStatus` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `issueDate` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `issuingAuthority` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `targetDate` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `DocumentIdentity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentInsurance` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fileData` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileName` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileSize` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileType` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DocumentIdentity" DROP CONSTRAINT "DocumentIdentity_id_fkey";

-- DropForeignKey
ALTER TABLE "DocumentInsurance" DROP CONSTRAINT "DocumentInsurance_id_fkey";

-- DropIndex
DROP INDEX "Document_ownerId_category_idx";

-- DropIndex
DROP INDEX "Document_ownerId_targetDate_idx";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "category",
DROP COLUMN "deadlineType",
DROP COLUMN "extractionStatus",
DROP COLUMN "issueDate",
DROP COLUMN "issuingAuthority",
DROP COLUMN "targetDate",
DROP COLUMN "title",
DROP COLUMN "updatedAt",
DROP COLUMN "version",
ADD COLUMN     "fileData" BYTEA NOT NULL,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "fileType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- DropTable
DROP TABLE "DocumentIdentity";

-- DropTable
DROP TABLE "DocumentInsurance";

-- DropEnum
DROP TYPE "DeadlineType";

-- DropEnum
DROP TYPE "DocumentCategory";

-- DropEnum
DROP TYPE "ExtractionStatus";

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");
