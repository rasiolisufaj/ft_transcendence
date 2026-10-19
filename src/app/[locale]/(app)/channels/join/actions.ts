"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

export async function joinChannel(formData: FormData) {
  const { user } = await requireUser();

  const channelId = formData.get("channelId");
  if (typeof channelId !== "string" || !channelId) return;

  const trueChannelId = channelId.trim();
  if (trueChannelId.length === 0) return;

  const intChannelId = parseInt(trueChannelId, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0) return;

  const channel = await prisma.channel.findUnique({
    where: { id: intChannelId },
  });
  if (!channel) return;
  if (channel.isPrivate) return;
  if (channel.isClosed) return;

  await prisma.channelMember.createMany({
    data: { channelId: intChannelId, userId: user.id, role: "MEMBER" },
    skipDuplicates: true,
  });

  redirect({ href: `/channels/${intChannelId}`, locale: await getLocale() });
}

export default async function requestJoinChannel(formData: FormData) {
  const { user } = await requireUser();

  const channelId = formData.get("channelId");
  if (typeof channelId !== "string") return;

  const trueChannelId = channelId.trim();
  if (trueChannelId.length === 0) return;

  const intChannelId = parseInt(trueChannelId, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0) return;

  const channel = await prisma.channel.findUnique({
    where: { id: intChannelId },
  });
  if (!channel) return;
  if (!channel.isPrivate) return;
  if (channel.isClosed) return;

  const alreadyMember = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: user.id },
  });
  if (alreadyMember) return;

  try {
    await prisma.channelJoinRequest.create({
      data: {
        channelId: intChannelId,
        userId: user.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }

  revalidatePath("/[locale]/channels/join", "page");
}
