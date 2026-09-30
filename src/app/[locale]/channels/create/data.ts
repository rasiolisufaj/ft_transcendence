
import { prisma } from "@/lib/db";

export async function getUserChannels(email: string) {
  return prisma.channel.findMany({
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
}

// renvoie tous les utilisateurs du site
export async function getAllUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });

  return users;
}


export async function getInvitationsChannel (email : string)
{
  return prisma.channelInvite.findMany({
   
      where: { user: { email: email } },
    include: { channel: { select: { title: true, description: true, members: true} } },
  });
}


