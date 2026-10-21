import { prisma } from "@/lib/db";

export async function isChannelMember(userId: string, channelId: number): Promise<boolean> {
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  return member !== null;
}
