import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications/notifications";

export type FriendError = "self" | "notFound" | "blocked" | "notPending";
export type Result = { ok: true } | { ok: false; error: FriendError };

const ok: Result = { ok: true };
const fail = (error: FriendError): Result => ({ ok: false, error });

// A→B or B→A: the unique index only covers one direction.
function between(a: string, b: string) {
  return {
    OR: [
      { requesterId: a, receiverId: b },
      { requesterId: b, receiverId: a },
    ],
  };
}

// Emails are stored lowercase (see signup).
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

  // The read (between) and the write below must be atomic, or A→B and B→A sent at the
  // same instant both pass the read and both insert — two rows instead of one accepted
  // friendship. Serializable makes Postgres abort one side (P2034) instead; retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { result, created } = await prisma.$transaction(
        async (tx) => {
          const rows = await tx.friendship.findMany({ where: between(me, other) });

          if (rows.some((row) => row.status === "BLOCKED")) {
            return { result: fail("blocked"), created: false };
          }

          // Already friends or already asked (double click): nothing to do.
          if (rows.some((row) => row.status === "ACCEPTED" || row.requesterId === me)) {
            return { result: ok, created: false };
          }

          const theirs = rows.find((row) => row.requesterId === other && row.status === "PENDING");
          if (theirs) {
            await tx.friendship.update({ where: { id: theirs.id }, data: { status: "ACCEPTED" } });
            return { result: ok, created: false };
          }

          try {
            await tx.friendship.create({ data: { requesterId: me, receiverId: other } });
          } catch (error) {
            const code = (error as { code?: string }).code;
            // The other user was deleted since the lookup: the foreign key refused the row.
            if (code === "P2003") return { result: fail("notFound"), created: false };
            // Simultaneous clicks: the unique index refused the 2nd row.
            if (code !== "P2002") throw error;
            return { result: ok, created: false };
          }
          return { result: ok, created: true };
        },
        { isolationLevel: "Serializable" },
      );
      if (created) await notify(other, "FRIEND_REQUEST", { userId: me });
      return result;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt === 0) continue;
      throw error;
    }
  }
  // Unreachable: the loop always returns or throws.
  throw new Error("sendRequest: retry loop exhausted");
}

export async function acceptRequest(me: string, requester: string): Promise<Result> {
  const { count } = await prisma.friendship.updateMany({
    where: { requesterId: requester, receiverId: me, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });
  if (count > 0) {
    return ok;
  }

  // Second click: already accepted, not an error.
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
