import { prisma } from "@/lib/db";

export async function getJoinableChannels(userId: string) {
  const channels = await prisma.channel.findMany({
    where: {
      members: { none: { userId } },
      isClosed: false,
    },
    include: {
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = await prisma.channelJoinRequest.findMany({
    where: { userId, channelId: { in: channels.map((c) => c.id) } },
    select: { channelId: true },
  });
  const pendingIds = new Set(pending.map((r) => r.channelId));

  return channels.map((channel) => ({
    ...channel,
    hasPendingRequest: pendingIds.has(channel.id),
  }));
}
