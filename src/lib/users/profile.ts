import { prisma } from "@/lib/db";

/**
 * User ids are cuids: letters and digits. Anything else is no user, and checking first
 * keeps a NUL byte from a crafted URL away from Postgres, which would throw (a 500).
 */
export function isUserId(id: string): boolean {
  return /^[a-z0-9]{1,40}$/i.test(id);
}

export type Relation = "friend" | "pending" | "blocked" | "none";

/**
 * What viewerId is to userId, from the Friendship rows between them in either direction.
 * A block in either direction wins: D15, "blocking hides both directions".
 * The caller handles viewerId === userId (the profile's owner) before asking.
 */
export async function relationBetween(viewerId: string, userId: string): Promise<Relation> {
  const rows = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: viewerId, receiverId: userId },
        { requesterId: userId, receiverId: viewerId },
      ],
    },
    select: { status: true },
  });
  if (rows.some((row) => row.status === "BLOCKED")) return "blocked";
  if (rows.some((row) => row.status === "ACCEPTED")) return "friend";
  // Any row left is a PENDING request, in one direction or the other.
  return rows.length > 0 ? "pending" : "none";
}
