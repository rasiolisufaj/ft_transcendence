import { prisma } from "@/lib/db";

export async function getJoinableChannels(userId: string) {
  return prisma.channel.findMany({
    where: {
      members: { none: { userId } },
    },
    include: { _count: { select: { members: true } } },
  });
}
