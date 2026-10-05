
import { prisma } from "@/lib/db";

export async function getChannelJoinRequests(channelId: number) {
  return prisma.channelJoinRequest.findMany({
    where: { channelId },
    include: {
      user: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}