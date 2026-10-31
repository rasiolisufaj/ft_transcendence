import { prisma } from "@/lib/db";

export type MessageError = "self" | "notFriends";

// The unique index is on (participant1Id, participant2Id): sorted ids, so A→B and B→A share it.
export function pair(a: string, b: string) {
  return a < b ? { participant1Id: a, participant2Id: b } : { participant1Id: b, participant2Id: a };
}

// A block deletes the friendship (see block()), so friends-only also refuses a blocked sender.
export async function areFriends(a: string, b: string): Promise<boolean> {
  const count = await prisma.friendship.count({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, receiverId: b },
        { requesterId: b, receiverId: a },
      ],
    },
  });
  return count > 0;
}

// A native INSERT … ON CONFLICT: two first messages sent at once still make one row.
function openConversation(a: string, b: string) {
  return prisma.conversation.upsert({
    where: { participant1Id_participant2Id: pair(a, b) },
    create: pair(a, b),
    update: { updatedAt: new Date() },
  });
}

export async function sendMessage(me: string, other: string, content: string) {
  if (me === other) {
    return { ok: false as const, error: "self" as MessageError };
  }
  if (!(await areFriends(me, other))) {
    return { ok: false as const, error: "notFriends" as MessageError };
  }
  const conversation = await openConversation(me, other);
  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: me, content },
  });
  return { ok: true as const, message };
}

export async function listMessages(me: string, other: string) {
  return prisma.message.findMany({
    where: { conversation: pair(me, other) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, content: true, senderId: true, createdAt: true },
  });
}

export async function listConversations(me: string) {
  const person = { select: { id: true, displayName: true } };
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ participant1Id: me }, { participant2Id: me }] },
    orderBy: { updatedAt: "desc" },
    include: {
      participant1: person,
      participant2: person,
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { content: true, senderId: true, createdAt: true },
      },
    },
  });
  return Promise.all(
    rows.map(async (row) => {
      const iAmFirst = row.participant1Id === me;
      const other = iAmFirst ? row.participant2 : row.participant1;
      const readAt = iAmFirst ? row.participant1ReadAt : row.participant2ReadAt;
      const unread = await prisma.message.count({
        where: { conversationId: row.id, senderId: other.id, ...(readAt ? { createdAt: { gt: readAt } } : {}) },
      });
      return { id: row.id, other, lastMessage: row.messages[0] ?? null, updatedAt: row.updatedAt, unread };
    }),
  );
}

// participant1 is the smaller id (see pair()), so my column depends on which one I am.
function sides(me: string, other: string) {
  const mineIsFirst = pair(me, other).participant1Id === me;
  return mineIsFirst
    ? ({ mine: "participant1ReadAt", theirs: "participant2ReadAt" } as const)
    : ({ mine: "participant2ReadAt", theirs: "participant1ReadAt" } as const);
}

export async function markRead(me: string, other: string) {
  const where = { participant1Id_participant2Id: pair(me, other) };
  const conversation = await prisma.conversation.findUnique({ where, select: { updatedAt: true } });
  if (!conversation) {
    return;
  }
  // updatedAt orders the list by last message: reading must not move it.
  await prisma.conversation.update({
    where,
    data: { [sides(me, other).mine]: new Date(), updatedAt: conversation.updatedAt },
  });
}

export async function readTimes(me: string, other: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { participant1Id_participant2Id: pair(me, other) },
    select: { participant1ReadAt: true, participant2ReadAt: true },
  });
  const { mine, theirs } = sides(me, other);
  return { mine: conversation?.[mine] ?? null, theirs: conversation?.[theirs] ?? null };
}

export function seenMessageId(
  messages: { id: number; senderId: string; createdAt: Date }[],
  me: string,
  theirReadAt: Date | null,
): number | null {
  const lastMine = messages.findLast((message) => message.senderId === me);
  return lastMine && theirReadAt && theirReadAt >= lastMine.createdAt ? lastMine.id : null;
}
