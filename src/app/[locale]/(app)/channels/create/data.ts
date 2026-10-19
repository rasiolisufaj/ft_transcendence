import { prisma } from "@/lib/db";

export async function getUserChannels(email: string) {
  const channels = await prisma.channel.findMany({
    where: {
      members: { some: { user: { email: email } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { user: { email: email } },
        select: { role: true },
      },
    },
  });

  const ids = channels.map((c) => c.id);
  const mods = await prisma.channelMember.groupBy({
    by: ["channelId"],
    where: { channelId: { in: ids }, role: "MODERATOR" },
    _count: { userId: true },
  });
  const modCountByChannel = new Map<number, number>();
  for (const row of mods) {
    modCountByChannel.set(row.channelId, row._count.userId);
  }

  return channels.map((channel) => ({
    ...channel,
    moderatorCount: modCountByChannel.get(channel.id) ?? 0,
  }));
}

export async function getAllUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });

  return users;
}

export async function getInvitableUsers(
  channelId: number,
  currentUserId: string,
) {
  const members = await prisma.channelMember.findMany({
    where: { channelId },
    select: { userId: true },
  });
  const invites = await prisma.channelInvite.findMany({
    where: { channelId },
    select: { userId: true },
  });
  const exclude = new Set<string>([
    currentUserId,
    ...members.map((m) => m.userId),
    ...invites.map((i) => i.userId),
  ]);
  const users = await prisma.user.findMany({
    where: { id: { notIn: Array.from(exclude) } },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });
  return users;
}

export async function getInvitationsChannel(email: string) {
  return prisma.channelInvite.findMany({
    where: { user: { email: email } },
    include: {
      channel: {
        select: { title: true, description: true, members: true },
      },
    },
  });
}
