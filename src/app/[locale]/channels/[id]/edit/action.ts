"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSeedUser } from "@/lib/auth/seed-user";

export async function editChannel(formData: FormData) {
  const user = await getSeedUser();

  const strId = formData.get("channelId");
  const newNameChannel = formData.get("name");
  const newDescriptionChannel = formData.get("description");
  const newQuestionChannel = formData.get("question");

  if (typeof strId !== "string" || !strId)
    return;

  const strTrueId = strId.trim();
  if (strTrueId.length === 0)
    return;

  const intId = parseInt(strTrueId, 10);
  if (Number.isNaN(intId) || intId <= 0)
    return;

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

  const channel = await prisma.channel.findUnique({
    where: { id: intId },
    select: { createdBy: true }, 
  });
  if (!channel) {
    return;
  }

  if (channel.createdBy !== user.id) {
   return;
  }

  await prisma.channel.update({
    where: { id: intId },
    data: {
      title: truenewNameChannel,
      description: truenewDescriptionChannel,
    },
  });

  const strQuestionId = formData.get("questionId");
  if (typeof strQuestionId === "string") {
    const questionId = parseInt(strQuestionId, 10);
    if (!Number.isNaN(questionId) && questionId > 0) {
      await prisma.thread.updateMany({
        where: { id: questionId, channelId: intId },
        data: { content: truenewQuestionChannel },
      });
    }
  }

  revalidatePath(`/channels/${intId}`);
  redirect({ href: `/channels/${intId}`, locale: await getLocale() });
}
