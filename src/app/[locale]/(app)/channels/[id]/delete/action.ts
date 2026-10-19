"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

export async function deleteChannel(formData: FormData) {
  const idChannel = formData.get("deletechannel");
  if (typeof idChannel !== "string" || !idChannel) {
    return;
  }

  const trueId = parseInt(idChannel, 10);
  if (Number.isNaN(trueId) || trueId <= 0 || String(trueId) !== idChannel) {
    return;
  }
  const ctx = await requireUser();

  const channel = await prisma.channel.findUnique({
    where: { id: trueId },
    select: { createdBy: true },
  });
  if (!channel) {
    return;
  }

  // The creator while they still moderate the channel, or an admin (§C-20). createdBy is
  // null once the creator is deleted (§C-19): then only an admin matches.
  assertCan(ctx, "channel:delete", { channelId: trueId, ownerUserId: channel.createdBy });

  const { count } = await prisma.channel.deleteMany({
    where: {
      id: trueId,
    },
  });
  // After the delete, and only if it happened. AuditLog.channelId is a plain string,
  // not a foreign key, so the row outlives the channel.
  if (count > 0) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:delete",
      targetType: "Channel",
      targetId: String(trueId),
      channelId: trueId,
    });
  }
  revalidatePath("/channels");
  redirect({ href: "/channels", locale: await getLocale() });
}
