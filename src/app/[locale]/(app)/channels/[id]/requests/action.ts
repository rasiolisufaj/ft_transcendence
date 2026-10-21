"use server"
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

export async function acceptJoinRequest(formData: FormData) {
  const ctx = await requireUser();

  const idChannel = formData.get("channelId");
  const idUser = formData.get("userId");
  if (typeof idChannel !== "string" || typeof idUser !== "string") return;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) return;

  assertCan(ctx, "channel:moderate", { channelId: id });

  const joinRequest = await prisma.channelJoinRequest.findFirst({
    where: {
      channelId: id,
      userId: idUser,
    },
  });
  if (!joinRequest) return;

  await prisma.$transaction([
    prisma.channelMember.createMany({
      data: { channelId: id, userId: idUser, role: "MEMBER" },
      skipDuplicates: true,
    }),
    prisma.channelJoinRequest.deleteMany({
      where: { channelId: id, userId: idUser },
    }),
  ]);

  await writeAudit({
    actorUserId: ctx.user.id,
    action: "channel:acceptRequest",
    targetType: "User",
    targetId: idUser,
    channelId: id,
  });

  revalidatePath("/[locale]/(app)/channels/[id]/requests", "page");
}

export async function rejectJoinRequest(formData: FormData) {
  const ctx = await requireUser();

  const idChannel = formData.get("channelId");
  const idUser = formData.get("userId");
  if (typeof idChannel !== "string" || typeof idUser !== "string") return;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) return;

  assertCan(ctx, "channel:moderate", { channelId: id });

  const { count } = await prisma.channelJoinRequest.deleteMany({
    where: {
      channelId: id,
      userId: idUser,
    },
  });
  if (count > 0)
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:rejectRequest",
      targetType: "User",
      targetId: idUser,
      channelId: id,
    });

  revalidatePath("/[locale]/(app)/channels/[id]/requests", "page");
}
