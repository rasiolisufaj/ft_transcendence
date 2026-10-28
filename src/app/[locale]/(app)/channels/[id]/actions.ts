"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { publish } from "@/lib/realtime/publish";
// repasser sur les commentaires plus tard

export async function createAnswer(formData: FormData) {
  const answer = formData.get("content");
  if (typeof answer !== "string" || !answer) {
    return
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
    select: { channelId: true },
  });
  if (!thread) {
    return;
  }
  // Members of the thread's channel only (§C-15). The channel comes from the
  // thread row, never from the form.
  assertCan(ctx, "answer:create", { channelId: thread.channelId });

  const created = await prisma.answer.create({
    data: {
      content: trueAnswer,
      threadId: threadId,
      userId: ctx.user.id,
    },
  });
  await publish({
    type: "answer.created",
    channelId: thread.channelId,
    threadId,
    answerId: created.id,
    actorUserId: ctx.user.id,
    at: created.createdAt.toISOString(),
  });
  revalidatePath(`/channels/${thread.channelId}`);
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
  // The author, a moderator of the answer's own channel, or an admin (§5).
  assertCan(ctx, "answer:delete", { channelId, ownerUserId: answer.userId });

  const { count } = await prisma.answer.deleteMany({
    where: {
      id: trueId,
    },
  });
  // An author removing their own answer is not moderation: only someone else's is audited.
  if (count > 0 && answer.userId !== ctx.user.id) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "answer:delete",
      targetType: "Answer",
      targetId: String(trueId),
      channelId,
    });
  }
  revalidatePath(`/channels/${channelId}`);
}

// fonction pour modifier un user
export async function modifAnswerUser(formData: FormData) {
  // recupere les info donc id de la reponse
  // recupere aisso la nouvelle reponse
  const answerId = formData.get("answerId");
  const newanswer = formData.get("content");
  const channelId = formData.get("channelId");

  // verifie que c'est les bon types
  if (
    typeof channelId !== "string" ||
    typeof answerId !== "string" ||
    typeof newanswer !== "string" ||
    !answerId ||
    !newanswer
  ) {
    return;
  }

  // surpime les espace
  const answerIdTrim = answerId.trim();
  const newanswerTrim = newanswer.trim();
  const channelIdTrim = channelId.trim();
  // verifie la taille
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

  // convertie lid de la reponse en int
  if (Number.isNaN(intAnswerId) || intAnswerId <= 0) {
    return;
  }
  // reucupere le user
  const ctx = await requireUser();

  const answer = await prisma.answer.findFirst({
    where: { id: intAnswerId },
    include: { thread: { select: { channelId: true } } },
  });

  // vérifie que la réponse existe
  if (!answer) {
    return;
  }

  // The author, or an admin. Moderators delete answers, they do not rewrite them.
  assertCan(ctx, "answer:update", { ownerUserId: answer.userId });
  await prisma.answer.update({
    where: { id: intAnswerId },
    data: { content: newanswerTrim },
  });
  // An admin rewriting someone else's words is moderation: audited, as deleteAnswer does.
  if (answer.userId !== ctx.user.id) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "answer:update",
      targetType: "Answer",
      targetId: String(intAnswerId),
      channelId: answer.thread.channelId,
    });
  }
  // The channel page 404s for a non-member (an admin), so send them back to the list.
  const isMember = ctx.memberships.some((m) => m.channelId === intChannelId);
  redirect({ href: isMember ? `/channels/${intChannelId}` : "/channels", locale: await getLocale() });
}


export async function leaveChannel(formData: FormData)
{
  const channelId = formData.get("channelId");

  if (typeof channelId !== "string" || !channelId)
    return;

  const channelIdtrim = channelId.trim();
  if (channelIdtrim.length === 0)
    return;

  const intChannelId = parseInt(channelIdtrim, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0 || String(intChannelId) !== channelIdtrim)
    return;

  const channel = await prisma.channel.findFirst({
    where: { id: intChannelId },
  });
  if (!channel)
    return;

  const { user } = await requireUser();

  const membership = await prisma.channelMember.findFirst({
    where: { channelId: channel.id, userId: user.id },
  });

  if (!membership)
    return;

  // Moderators may leave too (vision §3: a moderator can do everything a member can).
  // The channel may be left with no moderator: an admin moderates it (§C-19, §C-20).
  await prisma.channelMember.deleteMany({
    where: { channelId: channel.id, userId: user.id },
  });
  await publish({ type: "member.left", channelId: channel.id, userId: user.id, at: new Date().toISOString() });

  revalidatePath("/channels");
  redirect({ href: "/channels", locale: await getLocale() });
}
