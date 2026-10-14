"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
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

  const ctx = await requireUser();

  if (targetUserIdTrim === ctx.user.id)
    return;

  // A moderator of THIS channel, or an admin (§C-16): can() reads the caller's role
  // in the channel the form names, so a moderator of another channel is refused.
  assertCan(ctx, "channel:moderate", { channelId: intChannelId });

  // seul un MEMBER peut etre retire, jamais un autre moderateur
  const target = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: targetUserIdTrim, role: "MEMBER" },
  });
  if (!target)
    return;

  const { count } = await prisma.channelMember.deleteMany({
    where: { channelId: intChannelId, userId: targetUserIdTrim },
  });
  // Only a kick that happened is recorded.
  if (count > 0)
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:kick",
      targetType: "User",
      targetId: targetUserIdTrim,
      channelId: intChannelId,
    });

  revalidatePath("/[locale]/(app)/channels/[id]/kick", "page");
  revalidatePath("/[locale]/(app)/channels/[id]", "page");
}
