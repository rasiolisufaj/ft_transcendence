-- CreateTable
CREATE TABLE "ChannelJoinRequest" (
    "channel_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelJoinRequest_pkey" PRIMARY KEY ("channel_id","user_id")
);

-- CreateIndex
CREATE INDEX "ChannelJoinRequest_user_id_idx" ON "ChannelJoinRequest"("user_id");

-- AddForeignKey
ALTER TABLE "ChannelJoinRequest" ADD CONSTRAINT "ChannelJoinRequest_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelJoinRequest" ADD CONSTRAINT "ChannelJoinRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
