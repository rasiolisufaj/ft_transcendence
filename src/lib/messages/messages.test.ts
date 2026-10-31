import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { block } from "@/lib/friends/friendships";
import {
  listConversations,
  listMessages,
  markRead,
  pair,
  readTimes,
  seenMessageId,
  sendMessage,
} from "@/lib/messages/messages";

let alice: string;
let bob: string;
let carol: string;

async function createUser(name: string) {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: name },
  });
  return user.id;
}

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  carol = await createUser("Carol");
  await prisma.friendship.create({ data: { requesterId: alice, receiverId: bob, status: "ACCEPTED" } });
});

afterEach(async () => {
  // Cascades friendships, conversations and messages.
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob, carol] } } });
});

const conversationsOf = (a: string, b: string) => prisma.conversation.findMany({ where: pair(a, b) });

describe("pair", () => {
  it("orders the two ids, so both directions name one conversation", () => {
    expect(pair("bob", "alice")).toEqual({ participant1Id: "alice", participant2Id: "bob" });
    expect(pair("alice", "bob")).toEqual({ participant1Id: "alice", participant2Id: "bob" });
  });
});

describe("sendMessage", () => {
  it("sends a message to a friend", async () => {
    const result = await sendMessage(alice, bob, "Salut");

    expect(result).toMatchObject({ ok: true, message: { content: "Salut", senderId: alice } });
    expect(await prisma.message.count({ where: { senderId: alice } })).toBe(1);
  });

  it("uses one conversation for both directions", async () => {
    await sendMessage(alice, bob, "Salut");
    await sendMessage(bob, alice, "Coucou");

    const conversations = await conversationsOf(alice, bob);
    expect(conversations).toHaveLength(1);
    expect(await prisma.message.count({ where: { conversationId: conversations[0]!.id } })).toBe(2);
  });

  it("keeps one conversation when the first two messages cross", async () => {
    const results = await Promise.all([sendMessage(alice, bob, "Salut"), sendMessage(bob, alice, "Coucou")]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await conversationsOf(alice, bob)).toHaveLength(1);
  });

  it("refuses someone who is not a friend", async () => {
    expect(await sendMessage(alice, carol, "Salut")).toEqual({ ok: false, error: "notFriends" });
    expect(await conversationsOf(alice, carol)).toHaveLength(0);
  });

  it("refuses a friend who blocked you", async () => {
    await block(bob, alice);

    expect(await sendMessage(alice, bob, "Salut")).toEqual({ ok: false, error: "notFriends" });
  });

  it("refuses yourself", async () => {
    expect(await sendMessage(alice, alice, "Salut")).toEqual({ ok: false, error: "self" });
  });

  it("moves the conversation up when a message is sent", async () => {
    await sendMessage(alice, bob, "Salut");
    const [before] = await conversationsOf(alice, bob);
    await new Promise((resolve) => setTimeout(resolve, 20));

    await sendMessage(bob, alice, "Coucou");

    const [after] = await conversationsOf(alice, bob);
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });
});

const later = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("listMessages", () => {
  it("lists the conversation oldest first", async () => {
    await sendMessage(alice, bob, "Salut");
    await later();
    await sendMessage(bob, alice, "Coucou");

    const messages = await listMessages(alice, bob);

    expect(messages.map((m) => [m.senderId, m.content])).toEqual([
      [alice, "Salut"],
      [bob, "Coucou"],
    ]);
  });

  it("is the same list from both sides", async () => {
    await sendMessage(alice, bob, "Salut");

    expect(await listMessages(bob, alice)).toEqual(await listMessages(alice, bob));
  });

  it("is empty before the first message", async () => {
    expect(await listMessages(alice, bob)).toEqual([]);
  });
});

describe("listConversations", () => {
  it("lists the other person and the last message, most recent first", async () => {
    const dave = await createUser("Dave");
    await prisma.friendship.create({ data: { requesterId: dave, receiverId: alice, status: "ACCEPTED" } });
    await sendMessage(alice, bob, "Salut Bob");
    await later();
    await sendMessage(dave, alice, "Salut Alice");
    await later();
    await sendMessage(bob, alice, "Ça va ?");

    const conversations = await listConversations(alice);

    expect(conversations.map((c) => [c.other.displayName, c.lastMessage?.content])).toEqual([
      ["Bob", "Ça va ?"],
      ["Dave", "Salut Alice"],
    ]);
    await prisma.user.delete({ where: { id: dave } });
  });

  it("does not list other people's conversations", async () => {
    await sendMessage(alice, bob, "Salut");

    expect(await listConversations(carol)).toEqual([]);
  });
});

describe("markRead", () => {
  it("records when I read, on my side only", async () => {
    await sendMessage(bob, alice, "Salut");

    await markRead(alice, bob);

    const times = await readTimes(alice, bob);
    expect(times.mine).toBeInstanceOf(Date);
    expect(times.theirs).toBeNull();
    expect((await readTimes(bob, alice)).theirs).toEqual(times.mine);
  });

  it("does nothing before the first message", async () => {
    await markRead(alice, bob);

    expect(await conversationsOf(alice, bob)).toHaveLength(0);
    expect(await readTimes(alice, bob)).toEqual({ mine: null, theirs: null });
  });

  it("does not move the conversation up", async () => {
    await sendMessage(bob, alice, "Salut");
    const [before] = await conversationsOf(alice, bob);
    await later();

    await markRead(alice, bob);

    const [after] = await conversationsOf(alice, bob);
    expect(after!.updatedAt).toEqual(before!.updatedAt);
  });
});

describe("unread", () => {
  const unreadFor = async (me: string) => (await listConversations(me))[0]?.unread;

  it("counts the other's messages I have not read", async () => {
    await sendMessage(bob, alice, "Salut");
    await sendMessage(bob, alice, "Tu es là ?");

    expect(await unreadFor(alice)).toBe(2);
  });

  it("does not count my own messages", async () => {
    await sendMessage(alice, bob, "Salut");

    expect(await unreadFor(alice)).toBe(0);
  });

  it("drops to zero once read, and counts what comes after", async () => {
    await sendMessage(bob, alice, "Salut");
    await markRead(alice, bob);
    expect(await unreadFor(alice)).toBe(0);
    await later();

    await sendMessage(bob, alice, "Encore moi");

    expect(await unreadFor(alice)).toBe(1);
  });
});

describe("seenMessageId", () => {
  const at = (minute: number) => new Date(`2026-10-31T10:${String(minute).padStart(2, "0")}:00.000Z`);
  const messages = [
    { id: 1, senderId: "me", createdAt: at(1) },
    { id: 2, senderId: "me", createdAt: at(2) },
    { id: 3, senderId: "them", createdAt: at(3) },
  ];

  it("marks my last message once they read after it", () => {
    expect(seenMessageId(messages, "me", at(5))).toBe(2);
  });

  it("marks nothing before they read my last message", () => {
    expect(seenMessageId(messages, "me", at(1))).toBeNull();
  });

  it("marks nothing when they never read", () => {
    expect(seenMessageId(messages, "me", null)).toBeNull();
  });

  it("marks nothing when I sent nothing", () => {
    expect(seenMessageId(messages, "someone", at(5))).toBeNull();
  });
});
