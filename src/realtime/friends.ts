import { prisma } from "@/lib/db";

export type FriendsOf = (userId: string) => Promise<string[]>;

export async function friendsOf(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { receiverId: userId }] },
    select: { requesterId: true, receiverId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.receiverId : row.requesterId));
}
