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

export default async function requestJoinChannel(formData: FormData) {
  const { user } = await requireUser();

  const channelId = formData.get("channelId");
  if (typeof channelId !== "string") return;

  const trueChannelId = channelId.trim();
  if (trueChannelId.length === 0) return;

  const intChannelId = parseInt(trueChannelId, 10);
  if (isNaN(intChannelId)) return;

  const channel = await prisma.channel.findUnique({
    where: { id: intChannelId },
  });
  if (!channel) return;

  const alreadyMember = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: user.id },
  });
  if (alreadyMember) return;

  await prisma.channelJoinRequest.create({
    data: {
      channelId: intChannelId,
      userId: user.id,
    },
  });
}