import { prisma } from "@/lib/db";

export type MessageError = "self" | "notFriends";

// The unique index is on (participant1Id, participant2Id): sorted ids, so A→B and B→A share it.
export function pair(a: string, b: string) {
  return a < b ? { participant1Id: a, participant2Id: b } : { participant1Id: b, participant2Id: a };
}

// A block deletes the friendship (see block()), so friends-only also refuses a blocked sender.
async function areFriends(a: string, b: string): Promise<boolean> {
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
  return rows.map((row) => ({
    id: row.id,
    other: row.participant1Id === me ? row.participant2 : row.participant1,
    lastMessage: row.messages[0] ?? null,
    updatedAt: row.updatedAt,
  }));
}
