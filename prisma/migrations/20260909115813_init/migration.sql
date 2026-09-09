-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'INSURANCE');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "deadlineType" "DeadlineType" NOT NULL,
    "title" TEXT NOT NULL,
    "issuingAuthority" TEXT,
    "issueDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentIdentity" (
    "id" TEXT NOT NULL,
    "holderName" TEXT,
    "documentNumber" TEXT,
    "nationality" TEXT,

    CONSTRAINT "DocumentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentInsurance" (
    "id" TEXT NOT NULL,
    "insurer" TEXT,
    "policyNumber" TEXT,
    "premiumPerYear" DOUBLE PRECISION,
    "coverageType" TEXT,
    "anniversaryDate" TIMESTAMP(3),

    CONSTRAINT "DocumentInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Document_ownerId_targetDate_idx" ON "Document"("ownerId", "targetDate");

-- CreateIndex
CREATE INDEX "Document_ownerId_category_idx" ON "Document"("ownerId", "category");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentIdentity" ADD CONSTRAINT "DocumentIdentity_id_fkey" FOREIGN KEY ("id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInsurance" ADD CONSTRAINT "DocumentInsurance_id_fkey" FOREIGN KEY ("id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
