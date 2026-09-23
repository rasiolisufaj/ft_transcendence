
import { prisma } from "@/lib/db";
// Get all the channels where the user is a member.
// Newest channels first, with the number of members.
export async function getUserChannels(email: string) {
  return prisma.channel.findMany({
    // Keep only channels with at least one member who has this email
    where: {
      members: { some: { user: { email: email } } },
    },
    // Sort by creation date, newest first
    orderBy: { createdAt: "desc" },
    // Add the number of members for each channel
    include: {
      _count: { select: { members: true } },
    },
  });
}

export async function getAllChannels()
{
    
}