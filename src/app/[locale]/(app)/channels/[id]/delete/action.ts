"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
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
  const { user } = await requireUser();

  const member = await prisma.channelMember.findFirst({
    where: {
      channelId: trueId,
      userId: user.id,
      role: "MODERATOR",
    },
  });
  if (!member) {
    return;
  }

  await prisma.channel.deleteMany({
    where: {
      id: trueId,
    },
  });
  revalidatePath("/channels");
  redirect({ href: "/channels", locale: await getLocale() });
}