"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
  const idAnswer = formData.get("answerId");
  const newanswer = formData.get("newanswerId");

  if (typeof idAnswer !== "string" || !idAnswer) {
    return { error: "Merci d'entrer un nom de Channel." };
  }
  
  if(typeof newanswer !== "STRING" || )
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
     // recupère aussi id du channel
     // utile pour revalidatePath a la fin
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
