
import { prisma } from "@/lib/db";

export async function getUserChannels(email: string) {
  return prisma.channel.findMany({
    where: {
      members: { some: { user: { email: email } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
    },
  });
}

export async function getAllChannels()
{
    
}