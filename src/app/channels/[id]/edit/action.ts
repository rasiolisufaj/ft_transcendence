"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// plus tard il va falloir faire en sorte que la personne ne soit pas obligée de modifier tous les champs
export async function editChannel(formData: FormData) {
  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    return { error: "Utilisateur amir introuvable en base." };
  }

  // récupère l'id du channel
  const strId = formData.get("channelId");
  const newNameChannel = formData.get("name");
  const newDescriptionChannel = formData.get("description");
  const newQuestionChannel = formData.get("question");

  // vérifie si on reçoit bien l'id en string
  // et qu'il n'est pas nul
  if (typeof strId !== "string" || !strId)
    return;

  // trim la chaîne de caractères pour vérifier qu'il n'y a pas que des espaces
  let strTrueId = strId.trim();
  if (strTrueId.length === 0)
    return;

  // convertit la string en int
  let intId = parseInt(strTrueId, 10);
  if (Number.isNaN(intId) || intId <= 0)
    return;

  // vérifie que tous les nouveaux champs ne sont pas vides
  if (typeof newNameChannel !== "string" || typeof newDescriptionChannel !== "string" || typeof newQuestionChannel !== "string")
    return;
  else if (!newNameChannel || !newDescriptionChannel || !newQuestionChannel)
    return;

  const truenewNameChannel = newNameChannel.trim();
  const truenewDescriptionChannel = newDescriptionChannel.trim();
  const truenewQuestionChannel = newQuestionChannel.trim();

  if (truenewNameChannel.length === 0 || truenewDescriptionChannel.length === 0 || truenewQuestionChannel.length === 0)
    return;
  else if (truenewNameChannel.length >= 100 || truenewDescriptionChannel.length >= 251 || truenewQuestionChannel.length >= 301)
    return;
// verife si le channel existe est envoie le creator
  const channel = await prisma.channel.findUnique({
    where: { id: intId },
    select: { createdBy: true }, 
  });
  if (!channel) {
    return { error: "Ce channel n'existe pas." };
  }

  // verifie si cest bien le createur 
  if (channel.createdBy !== user.id) {
    return { error: "Tu n'as pas le droit de modifier ce channel." };
  }

  // le nom du channel est stocké dans "title"
  await prisma.channel.update({
    where: { id: intId },
    data: {
      title: truenewNameChannel,
      description: truenewDescriptionChannel,
    },
  });

  // la question est le content du thread du channel
  const strQuestionId = formData.get("questionId");
  if (typeof strQuestionId === "string") {
    const questionId = parseInt(strQuestionId, 10);
    if (!Number.isNaN(questionId) && questionId > 0) {
      // channelId dans le where pour ne pas modifier le thread d'un autre channel
      await prisma.thread.updateMany({
        where: { id: questionId, channelId: intId },
        data: { content: truenewQuestionChannel },
      });
    }
  }

  revalidatePath(`/channels/${intId}`);
  redirect(`/channels/${intId}`);
}
