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

  assertCan(ctx, "channel:moderate", { channelId: intChannelId });

  const target = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: targetUserIdTrim, role: "MEMBER" },
  });
  if (!target)
    return;

  const { count } = await prisma.channelMember.deleteMany({
    where: { channelId: intChannelId, userId: targetUserIdTrim },
  });
  if (count > 0)
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:kick",
      targetType: "User",
      targetId: targetUserIdTrim,
      channelId: intChannelId,
    });

  revalidatePath("/[locale]/channels/[id]/kick", "page");
  revalidatePath("/[locale]/channels/[id]", "page");
}
