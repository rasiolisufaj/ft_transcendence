import { describe, expect, it } from "vitest";
import { channelTopic, topicFor, userTopic, type RealtimeEvent } from "@/contracts/events";

const at = "2026-10-02T09:00:00.000Z";
const alice = "cmalice00000000000000000";

const examples: RealtimeEvent[] = [
  { type: "thread.created", channelId: 12, threadId: 40, actorUserId: alice, at },
  { type: "answer.created", channelId: 12, threadId: 40, answerId: 7, actorUserId: alice, at },
  { type: "answer.voted", channelId: 12, answerId: 7, score: 3, at },
  { type: "content.hidden", channelId: 12, targetType: "answer", targetId: 7, at },
  { type: "member.joined", channelId: 12, userId: alice, at },
  { type: "member.left", channelId: 12, userId: alice, at },
  { type: "member.roleChanged", channelId: 12, userId: alice, role: "MODERATOR", at },
  { type: "member.muted", channelId: 12, userId: alice, mutedUntil: null, at },
];

describe("topics", () => {
  it("names a channel topic after the channel id", () => {
    expect(channelTopic(12)).toBe("channel:12");
  });

  it("names a user topic after the user id", () => {
    expect(userTopic(alice)).toBe(`user:${alice}`);
  });
});

describe("topicFor", () => {
  for (const event of examples) {
    it(`sends ${event.type} to its channel`, () => {
      expect(topicFor(event)).toBe("channel:12");
    });
  }

  it("uses the event's own channel", () => {
    const event: RealtimeEvent = { type: "member.joined", channelId: 99, userId: alice, at };
    expect(topicFor(event)).toBe("channel:99");
  });
});
