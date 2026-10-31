-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "participant1_read_at" TIMESTAMP(3),
ADD COLUMN     "participant2_read_at" TIMESTAMP(3);
