"use server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
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
  // verifie que la personne invitee existe
  const invitedUser = await prisma.user.findUnique({
    where: { id: trueUserId },
  });
  if (!invitedUser) {
    return;
  }
  // verifie que le user existe
  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });

  if (!user) {
    return;
  }
  // verifie que le channel existe
  const channel = await prisma.channel.findFirst({
    where: { id: intChannelId },
  });

  if (!channel) {
    return;
  }
  // verifie que la personne qui invite est bien moderateur
  // du channel
  const member = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: user.id, role: "MODERATOR" },
  });
  if (!member) return;

  // verifie que le user ne soit pas deja cree
  const AlreadyMember = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: trueUserId },
  });

  if (AlreadyMember) {
    return;
  }

  // verifie dans la table channel invite si le user na pas deja inbite
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
  redirect("/channels");
}
