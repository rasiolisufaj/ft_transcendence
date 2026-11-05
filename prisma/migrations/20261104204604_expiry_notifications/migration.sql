/*
  Warnings:

  - A unique constraint covering the columns `[document_id,type]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DEADLINE_PASSED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "document_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_document_id_type_key" ON "Notification"("document_id", "type");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
