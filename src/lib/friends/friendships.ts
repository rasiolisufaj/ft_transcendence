import { prisma } from "@/lib/db";

export type FriendError = "self" | "notFound" | "blocked" | "notPending";
export type Result = { ok: true } | { ok: false; error: FriendError };

const ok: Result = { ok: true };
const fail = (error: FriendError): Result => ({ ok: false, error });

// Both directions between two users.
function between(a: string, b: string) {
  return {
    OR: [
      { requesterId: a, receiverId: b },
      { requesterId: b, receiverId: a },
    ],
  };
}

// Adding by email -> the only way now
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function sendRequest(me: string, other: string): Promise<Result> {
  if (me === other) {
    return fail("self");
  }

  const rows = await prisma.friendship.findMany({ where: between(me, other) });

  // if blocked -> not possible
  if (rows.some((row) => row.status === "BLOCKED")) {
    return fail("blocked");
  }

  // Already friends, already asked (double click): nothing to do.
  if (rows.some((row) => row.status === "ACCEPTED" || row.requesterId === me)) {
    return ok;
  }

  const theirs = rows.find((row) => row.requesterId === other && row.status === "PENDING");
  if (theirs) {
    await prisma.friendship.update({ where: { id: theirs.id }, data: { status: "ACCEPTED" } });
    return ok;
  }

  try {
    await prisma.friendship.create({ data: { requesterId: me, receiverId: other } });
  } catch (error) {
    // Two clicks at the same time: the unique index refused the second row. Fine.
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
  return ok;
}

export async function acceptRequest(me: string, requester: string): Promise<Result> {
  const { count } = await prisma.friendship.updateMany({
    where: { requesterId: requester, receiverId: me, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });
  if (count > 0) {
    return ok;
  }

  // Second click: it is already accepted, so this is not an error.
  const accepted = await prisma.friendship.count({
    where: { requesterId: requester, receiverId: me, status: "ACCEPTED" },
  });
  return accepted > 0 ? ok : fail("notPending");
}

export async function declineRequest(me: string, requester: string): Promise<Result> {
  await prisma.friendship.deleteMany({
    where: { requesterId: requester, receiverId: me, status: "PENDING" },
  });
  return ok;
}

export async function cancelRequest(me: string, receiver: string): Promise<Result> {
  await prisma.friendship.deleteMany({
    where: { requesterId: me, receiverId: receiver, status: "PENDING" },
  });
  return ok;
}

export async function removeFriend(me: string, other: string): Promise<Result> {
  await prisma.friendship.deleteMany({ where: { ...between(me, other), status: "ACCEPTED" } });
  return ok;
}

export async function block(me: string, other: string): Promise<Result> {
  if (me === other) {
    return fail("self");
  }

  await prisma.$transaction([
    prisma.friendship.deleteMany({ where: { ...between(me, other), status: { not: "BLOCKED" } } }),
    prisma.friendship.upsert({
      where: { requesterId_receiverId: { requesterId: me, receiverId: other } },
      create: { requesterId: me, receiverId: other, status: "BLOCKED" },
      update: { status: "BLOCKED" },
    }),
  ]);
  return ok;
}

export async function unblock(me: string, other: string): Promise<Result> {
  await prisma.friendship.deleteMany({
    where: { requesterId: me, receiverId: other, status: "BLOCKED" },
  });
  return ok;
}

type Person = { id: string; displayName: string };

export async function listFriendships(me: string) {
  const person = { select: { id: true, displayName: true } };
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: me }, { receiverId: me }] },
    include: { requester: person, receiver: person },
    orderBy: { updatedAt: "desc" },
  });

  const friends: Person[] = [];
  const incoming: Person[] = [];
  const outgoing: Person[] = [];
  const blocked: Person[] = [];

  for (const row of rows) {
    const iAsked = row.requesterId === me;
    const other = iAsked ? row.receiver : row.requester;

    if (row.status === "ACCEPTED") {
      friends.push(other);
    } else if (row.status === "PENDING") {
      if (iAsked) {
        outgoing.push(other);
      } else {
        incoming.push(other);
      }
    } else if (row.status === "BLOCKED" && iAsked) {
      blocked.push(other);
    }
  }

  return { friends, incoming, outgoing, blocked };
}
