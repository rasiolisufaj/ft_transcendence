-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('HARD', 'SOFT', 'PERIODIC', 'NONE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "deadlineType" "DeadlineType",
ADD COLUMN     "targetDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_deadlineType_targetDate_idx" ON "Document"("deadlineType", "targetDate");
