"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export async function joinChannel(formData: FormData) {
  const { user } = await requireUser();
  const channelId = Number(formData.get("channelId"));
  if (!Number.isInteger(channelId)) return;

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.isPrivate) return;

  await prisma.channelMember.createMany({
    data: { channelId, userId: user.id, role: "MEMBER" },
    skipDuplicates: true,
  });

  redirect({ href: `/channels/${channelId}`, locale: await getLocale() });
}