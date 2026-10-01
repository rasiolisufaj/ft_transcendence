// need to know what event is needed 
export type RealtimeEvent = never;

// every member of the channel
export const channelTopic = (channelId: number) => `channel:${channelId}`;

// one account only
export const userTopic = (userId: string) => `user:${userId}`;
