"use server";
import { prisma } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";

export async function inviteUser(formData: FormData) {
  const channelId = formData.get("channelId");
  const userId = formData.get("userId");

  if (
    typeof channelId !== "string" ||
    typeof userId !== "string" ||
    !userId ||
    !channelId
  ) {
    return;
  }

  const trueChannelId: string = channelId.trim();
  const trueUserId: string = userId.trim();

  if (trueChannelId.length === 0 || trueUserId.length === 0) {
    return;
  } else if (trueChannelId.length > 100) {
    return;
  }

  const intChannelId = parseInt(trueChannelId, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0) {
    return;
  }
  const invitedUser = await prisma.user.findUnique({
    where: { id: trueUserId },
  });
  if (!invitedUser) {
    return;
  }
  const { user } = await requireUser();
  const channel = await prisma.channel.findFirst({
    where: { id: intChannelId },
  });

  if (!channel) {
    return;
  }
  const member = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: user.id, role: "MODERATOR" },
  });
  if (!member) return;

  const AlreadyMember = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: trueUserId },
  });

  if (AlreadyMember) {
    return;
  }

  const AlreadyInvite = await prisma.channelInvite.findFirst({
    where: { channelId: intChannelId, userId: trueUserId },
  });
  if (AlreadyInvite) {
    return;
  }
  await prisma.channelInvite.create({
    data: {
      channelId: intChannelId,
      userId: trueUserId,
    },
  });
  redirect({ href: "/channels", locale: await getLocale() });
}
