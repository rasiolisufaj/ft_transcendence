"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";

export async function createAnswer(formData: FormData) {
  const answer = formData.get("content");
  if (typeof answer !== "string" || !answer) {
    return;
  }

  const trueAnswer = answer.trim();
  if (trueAnswer.length === 0) {
    return;
  } else if (trueAnswer.length >= 301) {
    return;
  }

  const threadIdText = formData.get("threadId");
  if (typeof threadIdText !== "string") {
    return;
  }
  const threadId = parseInt(threadIdText, 10);
  if (Number.isNaN(threadId) || threadId <= 0) {
    return;
  }

  const ctx = await requireUser();

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: { channelId: true, channel: { select: { isClosed: true } } },
  });
  if (!thread) {
    return;
  }
  if (thread.channel.isClosed) {
    return;
  }
  assertCan(ctx, "answer:create", { channelId: thread.channelId });

  await prisma.answer.create({
    data: {
      content: trueAnswer,
      threadId: threadId,
      userId: ctx.user.id,
    },
  });
  revalidatePath("/[locale]/channels/[id]", "page");
}

export async function deleteAnswer(formData: FormData) {
  const idAnswer = formData.get("answerId");

  if (typeof idAnswer !== "string" || !idAnswer) {
    return ;
  }

  const trueId = parseInt(idAnswer, 10);
  if (Number.isNaN(trueId) || trueId <= 0 || String(trueId) !== idAnswer) {
    return;
  }

  const ctx = await requireUser();

  const answer = await prisma.answer.findUnique({
    where: { id: trueId },
    select: { userId: true, thread: { select: { channelId: true } } },
  });
  if (!answer) {
    return;
  }
  const channelId = answer.thread.channelId;
  assertCan(ctx, "answer:delete", { channelId, ownerUserId: answer.userId });

  const { count } = await prisma.answer.deleteMany({
    where: {
      id: trueId,
    },
  });
  if (count > 0 && answer.userId !== ctx.user.id) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "answer:delete",
      targetType: "Answer",
      targetId: String(trueId),
      channelId,
    });
  }
  revalidatePath("/[locale]/channels/[id]", "page");
}

export async function modifAnswerUser(formData: FormData) {
  const answerId = formData.get("answerId");
  const newanswer = formData.get("content");
  const channelId = formData.get("channelId");

  if (
    typeof channelId !== "string" ||
    typeof answerId !== "string" ||
    typeof newanswer !== "string" ||
    !answerId ||
    !newanswer
  ) {
    return;
  }

  const answerIdTrim = answerId.trim();
  const newanswerTrim = newanswer.trim();
  const channelIdTrim = channelId.trim();
  if (
    answerIdTrim.length === 0 ||
    newanswerTrim.length === 0 ||
    channelIdTrim.length === 0
  ) {
    return;
  } else if (newanswerTrim.length > 300) {
    return;
  }
  const intAnswerId = parseInt(answerIdTrim, 10);
  const intChannelId = parseInt(channelIdTrim, 10);

  if (Number.isNaN(intAnswerId) || intAnswerId <= 0) {
    return;
  }
  const ctx = await requireUser();

  const answer = await prisma.answer.findFirst({
    where: { id: intAnswerId },
    include: { thread: { select: { channelId: true } } },
  });

  if (!answer) {
    return;
  }

  assertCan(ctx, "answer:update", { ownerUserId: answer.userId });
  await prisma.answer.update({
    where: { id: intAnswerId },
    data: { content: newanswerTrim },
  });
  if (answer.userId !== ctx.user.id) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "answer:update",
      targetType: "Answer",
      targetId: String(intAnswerId),
      channelId: answer.thread.channelId,
    });
  }
  const isMember = ctx.memberships.some((m) => m.channelId === intChannelId);
  redirect({ href: isMember ? `/channels/${intChannelId}` : "/channels", locale: await getLocale() });
}


export async function toggleCloseChannel(formData: FormData) {
  const idChannel = formData.get("channelId");
  if (typeof idChannel !== "string" || !idChannel) return;

  const trim = idChannel.trim();
  if (trim.length === 0) return;

  const intId = parseInt(trim, 10);
  if (Number.isNaN(intId) || intId <= 0 || String(intId) !== trim) return;

  const ctx = await requireUser();

  const channel = await prisma.channel.findUnique({
    where: { id: intId },
    select: { createdBy: true, isClosed: true },
  });
  if (!channel) return;

  assertCan(ctx, "channel:delete", {
    channelId: intId,
    ownerUserId: channel.createdBy,
  });

  await prisma.channel.update({
    where: { id: intId },
    data: { isClosed: !channel.isClosed },
  });

  await writeAudit({
    actorUserId: ctx.user.id,
    action: channel.isClosed ? "channel:reopen" : "channel:close",
    targetType: "Channel",
    targetId: String(intId),
    channelId: intId,
  });

  revalidatePath("/[locale]/channels/[id]", "page");
  revalidatePath("/[locale]/channels", "page");
}

export async function leaveChannel(formData: FormData) {
  const channelId = formData.get("channelId");

  if (typeof channelId !== "string" || !channelId) return;

  const channelIdtrim = channelId.trim();
  if (channelIdtrim.length === 0) return;

  const intChannelId = parseInt(channelIdtrim, 10);
  if (
    Number.isNaN(intChannelId) ||
    intChannelId <= 0 ||
    String(intChannelId) !== channelIdtrim
  )
    return;

  const channel = await prisma.channel.findFirst({
    where: { id: intChannelId },
  });
  if (!channel) return;

  const { user } = await requireUser();

  const membership = await prisma.channelMember.findFirst({
    where: { channelId: channel.id, userId: user.id },
  });
  if (!membership) return;

  if (membership.role === "MODERATOR") {
    const otherMods = await prisma.channelMember.count({
      where: {
        channelId: channel.id,
        role: "MODERATOR",
        userId: { not: user.id },
      },
    });
    if (otherMods === 0) {
      return;
    }
  }

  await prisma.channelMember.deleteMany({
    where: { channelId: channel.id, userId: user.id },
  });

  revalidatePath("/[locale]/channels", "page");
  redirect({ href: "/channels", locale: await getLocale() });
}
