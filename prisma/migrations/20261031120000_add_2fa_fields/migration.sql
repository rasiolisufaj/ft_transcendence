-- AlterTable
ALTER TABLE "User" ADD COLUMN "recoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "twoFactorVerifiedAt" TIMESTAMP(3);
