
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

// renvoie tous les utilisateurs du site
export async function getAllUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });

  return users;
}