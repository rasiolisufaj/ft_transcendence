type ThreadCreated = {
  type: "thread.created";
  channelId: number;
  threadId: number;
  actorUserId: string; // who posted it
  at: string; // when, as new Date().toISOString()
};

type AnswerCreated = {
  type: "answer.created";
  channelId: number;
  threadId: number; // the question it answers
  answerId: number;
  actorUserId: string; // who answered
  at: string;
};

type AnswerVoted = {
  type: "answer.voted";
  channelId: number;
  answerId: number;
  score: number;
  at: string;
};

type ContentHidden = {
  type: "content.hidden";
  channelId: number;
  targetType: "thread" | "answer"; // what was hidden
  targetId: number; // its threadId or answerId
  at: string;
};

type MemberJoined = {
  type: "member.joined";
  channelId: number;
  userId: string; // who joined
  at: string;
};

type MemberLeft = {
  type: "member.left";
  channelId: number;
  userId: string; // who left
  at: string;
};

type MemberRoleChanged = {
  type: "member.roleChanged";
  channelId: number;
  userId: string; // whose role changed
  role: "MEMBER" | "MODERATOR"; // the new role
  at: string;
};

type MemberMuted = {
  type: "member.muted";
  channelId: number;
  userId: string; // who was muted
  mutedUntil: string | null; // until when; null = unmuted
  at: string;
};

export type RealtimeEvent =
  | ThreadCreated
  | AnswerCreated
  | AnswerVoted
  | ContentHidden
  | MemberJoined
  | MemberLeft
  | MemberRoleChanged
  | MemberMuted;

// all member of the channel
export const channelTopic = (channelId: number) => `channel:${channelId}`;

// one account only
export const userTopic = (userId: string) => `user:${userId}`;

export function topicFor(event: RealtimeEvent): string {
  return channelTopic(event.channelId);
}
