-- CreateTable
CREATE TABLE "ChannelInvite" (
    "channel_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelInvite_pkey" PRIMARY KEY ("channel_id","user_id")
);

-- AddForeignKey
ALTER TABLE "ChannelInvite" ADD CONSTRAINT "ChannelInvite_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInvite" ADD CONSTRAINT "ChannelInvite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
