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

  assertCan(ctx, "channel:delete", { channelId: trueId, ownerUserId: channel.createdBy });

  await writeAudit({
    actorUserId: ctx.user.id,
    action: "channel:delete",
    targetType: "Channel",
    targetId: String(trueId),
    channelId: trueId,
  });
  await prisma.channel.deleteMany({ where: { id: trueId } });

  revalidatePath("/[locale]/(app)/channels", "page");
  redirect({ href: "/channels", locale: await getLocale() });
}
