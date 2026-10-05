"use server"
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";

export async function acceptJoinRequest(formData: FormData) {
  const { user } = await requireUser();

  const idChannel = formData.get("channelId");
  const idUser = formData.get("userId");
  if (typeof idChannel !== "string" || typeof idUser !== "string") return;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) return;

  const userMember = await prisma.channelMember.findFirst({
    where: {
      userId: user.id,
      channelId: id,
    },
  });
  if (!userMember || userMember.role !== "MODERATOR") return;

  const joinRequest = await prisma.channelJoinRequest.findFirst({
    where: {
      channelId: id,
      userId: idUser,
    },
  });
  if (!joinRequest) return;

  await prisma.channelMember.create({
    data: {
      channelId: id,
      userId: idUser,
      role: "MEMBER",
    },
  });

  await prisma.channelJoinRequest.deleteMany({
    where: {
      channelId: id,
      userId: idUser,
    },
  });

  revalidatePath("/[locale]/channels/[id]/requests", "page");
}

export async function rejectJoinRequest(formData: FormData) {
  const { user } = await requireUser();

  const idChannel = formData.get("channelId");
  const idUser = formData.get("userId");
  if (typeof idChannel !== "string" || typeof idUser !== "string") return;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) return;

  const userMember = await prisma.channelMember.findFirst({
    where: {
      userId: user.id,
      channelId: id,
    },
  });
  if (!userMember || userMember.role !== "MODERATOR") return;

  await prisma.channelJoinRequest.deleteMany({
    where: {
      channelId: id,
      userId: idUser,
    },
  });

  revalidatePath("/[locale]/channels/[id]/requests", "page");
}
