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
  const userId = formData.get("userId");

  if (
    typeof userId !== "string" ||
    typeof channelId !== "string" ||
    !channelId ||
    !userId
  )
    return;

  const trueChannelId = channelId.trim();
  const trueUserId: string = userId.trim();

  if (trueChannelId.length === 0 || trueUserId.length === 0) return;

  const intChannelID = parseInt(trueUserId, 10);
  if (isNaN(intChannelID)) return;

  // Check if the channel exists and if the user is already a member
  const alreadyMember = await prisma.channelMember.findFirst({
    where: { channelId: intChannelID, userId: trueUserId },
  });
  if (alreadyMember) return;

  prisma.channelJoinRequest.create({
    data: {
      channelId: intChannelID,
      userId: trueUserId,
    },
  });
}
