"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";

export async function kickMembers(formData: FormData) {
  const channelId = formData.get("channelId");
  const targetUserId = formData.get("userId");

  if (typeof channelId !== "string" || typeof targetUserId !== "string" || !channelId || !targetUserId)
    return;

  const channelIdTrim = channelId.trim();
  const targetUserIdTrim = targetUserId.trim();
  if (channelIdTrim.length === 0 || targetUserIdTrim.length === 0)
    return;

  const intChannelId = parseInt(channelIdTrim, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0 || String(intChannelId) !== channelIdTrim)
    return;

  const { user } = await requireUser();

  if (targetUserIdTrim === user.id)
    return;

  const moderator = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: user.id, role: "MODERATOR" },
  });
  if (!moderator)
    return;

  // seul un MEMBER peut etre retire, jamais un autre moderateur
  const target = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: targetUserIdTrim, role: "MEMBER" },
  });
  if (!target)
    return;

  await prisma.channelMember.deleteMany({
    where: { channelId: intChannelId, userId: targetUserIdTrim },
  });

  revalidatePath("/[locale]/(app)/channels/[id]/kick", "page");
  revalidatePath("/[locale]/(app)/channels/[id]", "page");
}
