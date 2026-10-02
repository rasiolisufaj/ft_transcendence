type ThreadCreated = {
  type: "thread.created";
  channelId: number;
  threadId: number;
  actorUserId: string; // who posted it
  at: string; // when, as new Date().toISOString()
};

export type RealtimeEvent = ThreadCreated;

// all member of the channel
export const channelTopic = (channelId: number) => `channel:${channelId}`;

// one account only
export const userTopic = (userId: string) => `user:${userId}`;
