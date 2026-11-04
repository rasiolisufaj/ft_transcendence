-- CreateIndex
CREATE INDEX "Answer_thread_id_idx" ON "Answer"("thread_id");

-- CreateIndex
CREATE INDEX "ChannelMember_user_id_idx" ON "ChannelMember"("user_id");

-- CreateIndex
CREATE INDEX "Friendship_receiver_id_idx" ON "Friendship"("receiver_id");

-- CreateIndex
CREATE INDEX "Message_conversation_id_idx" ON "Message"("conversation_id");

-- CreateIndex
CREATE INDEX "Notification_recipient_id_idx" ON "Notification"("recipient_id");
