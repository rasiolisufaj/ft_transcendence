"use server";

import { prisma } from "@/lib/db";
import { channel } from "diagnostics_channel";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// repasser sur les commentaires plus tard

export async function createAnswer(formData: FormData) {
  const answer = formData.get("content");
  if (typeof answer !== "string" || !answer) {
    return { error: "Merci d'écrire une réponse." };
  }

  let trueAnswer = answer.trim();
  if (trueAnswer.length === 0) {
    return { error: "Merci d'écrire une réponse." };
  } else if (trueAnswer.length >= 301) {
    return { error: "Ta réponse est trop longue (300 caractères max)." };
  }

  const threadIdText = formData.get("threadId");
  if (typeof threadIdText !== "string") {
    return;
  }
  const threadId = parseInt(threadIdText, 10);
  if (Number.isNaN(threadId) || threadId <= 0) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    return;
  }

  // verifie que la question existe et le user est menbre du channel
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      channel: {
        members: { some: { userId: user.id } },
      },
    },
  });
  if (!thread) {
    return;
  }
  await prisma.answer.create({
    data: {
      content: trueAnswer,
      threadId: threadId,
      userId: user.id,
    },
  });
  revalidatePath(`/channels/${thread.channelId}`);
}

export async function deleteAnswer(formData: FormData) {
  const idAnswer = formData.get("answerId");

  if (typeof idAnswer !== "string" || !idAnswer) {
    return { error: "Merci d'entrer un nom de Channel." };
  }

  const trueId = parseInt(idAnswer, 10);
  if (Number.isNaN(trueId) || trueId <= 0 || String(trueId) !== idAnswer) {
    return Response.json({ error: "id invalide" }, { status: 400 });
  }

  // va recupere le user dans la basse de donnee
  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  // si il nexiste pas
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const answer = await prisma.answer.findFirst({
    where: {
      id: trueId,
      userId: user.id,
    },
    include: { thread: { select: { channelId: true } } },
  });
  if (!answer) {
    throw new Error("Utilisateur introuvable");
  }

  await prisma.answer.delete({
    where: {
      id: trueId,
    },
  });
  revalidatePath(`/channels/${answer.thread.channelId}`);
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
  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    return;
  }

  const answer = await prisma.answer.findFirst({
    where: { id: intAnswerId },
  });

  // vérifie que la réponse existe
  if (!answer) {
    return;
  }

  // vérifie que l'utilisateur est l'auteur de la réponse
  if (answer.userId !== user.id) {
    return;
  }
  await prisma.answer.update({
    where: { id: intAnswerId },
    data: { content: newanswerTrim },
  });
  redirect(`/channels/${intChannelId}`);
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

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user)
    return;

  const membership = await prisma.channelMember.findFirst({
    where: { channelId: channel.id, userId: user.id },
  });

  if (!membership)
    return;

  if (membership.role === "MODERATOR")
    return;

  await prisma.channelMember.deleteMany({
    where: { channelId: channel.id, userId: user.id },
  });

  revalidatePath("/channels");
  redirect("/channels");
}

export async function kickMember(formData: FormData)
{
  const channelId = formData.get("channelId");
  const targetUserId = formData.get("userId");

  if (typeof channelId !== "string" || typeof targetUserId !== "string" || !channelId || !targetUserId)
    return;

  const channelIdtrim = channelId.trim();
  const targetUserIdTrim = targetUserId.trim();
  if (channelIdtrim.length === 0 || targetUserIdTrim.length === 0)
    return;

  const intChannelId = parseInt(channelIdtrim, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0 || String(intChannelId) !== channelIdtrim)
    return;

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user)
    return;

  if (targetUserIdTrim === user.id)
    return;

  const moderator = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: user.id, role: "MODERATOR" },
  });
  if (!moderator)
    return;

  const target = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: targetUserIdTrim },
  });
  if (!target)
    return;

  if (target.role === "MODERATOR")
    return;

  await prisma.channelMember.deleteMany({
    where: { channelId: intChannelId, userId: targetUserIdTrim },
  });

  revalidatePath(`/channels/${intChannelId}`);
}
