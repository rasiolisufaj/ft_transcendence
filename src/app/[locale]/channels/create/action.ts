"use server";

import { prisma } from "@/lib/db";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { getSeedUser } from "@/lib/auth/seed-user";

export async function createChannel(formData: FormData) {
  const nameChannel = formData.get("name");
  let descriptionChannel = formData.get("description");
  let answer = formData.get("question");
  // Check that the channel name is not empty
  // and does not contain only spaces.
  if (typeof nameChannel !== "string" || !nameChannel) {
    return;
  }

  const trueNameChannel: string = nameChannel.trim();
  if (trueNameChannel.length === 0) {
    return;
  } else if (trueNameChannel.length >= 100) {
    return;
  }

  if (typeof answer !== "string" || !answer) {
    return;
  }

  const trueQuestion: string = answer.trim();
  if (trueQuestion.length === 0) {
    return;
  } else if (trueQuestion.length > 300) {
    return;
  }

  // Check that the description is a string.
  // Remove spaces at the start and the end.
  // Check if the description is empty.
  // Check that its length is correct.
  // Set hasDescription to true.
  let cleanDescription: string | null = null;

  if (typeof descriptionChannel === "string" && descriptionChannel) {
    const truedescriptionChannel: string = descriptionChannel.trim();
    if (truedescriptionChannel.length === 0) {
      cleanDescription = null;
    } else if (truedescriptionChannel.length >= 251) {
      return;
    } else {
      cleanDescription = truedescriptionChannel;
    }
  }

  const user = await getSeedUser();

  const existingChannel = await prisma.channel.findFirst({
    where: { title: { equals: trueNameChannel, mode: "insensitive" } },
  });
  if (existingChannel) {
    return;
  }

  const newChannel = await prisma.channel.create({
    data: {
      createdBy: user.id,
      title: trueNameChannel,
      description: cleanDescription,
      members: {
        create: { userId: user.id, role: "MODERATOR" },
      },
      threads: {
        create: {
          title: trueNameChannel,
          userId: user.id,
          content: trueQuestion,
        },
      },
    },
  });
  redirect({ href: "/channels", locale: await getLocale() });
}

export async function deleteChannel(formData: FormData) {
  const idChannel = formData.get("deletechannel");
  // id doit etre un texte non vide
  if (typeof idChannel !== "string" || !idChannel) {
    return;
  }

  // transforme le texte en nombre et check que cest un vrai id
  const trueId = parseInt(idChannel, 10);
  if (Number.isNaN(trueId) || trueId <= 0 || String(trueId) !== idChannel) {
    return;
  }
  // trouve le user
  const user = await getSeedUser();

  // verifie que le user est bien membre du channel
  // et qu'il est bien moderateur
  const member = await prisma.channelMember.findFirst({
    where: {
      channelId: trueId,
      userId: user.id,
      role: "MODERATOR",
    },
  });
  if (!member) {
    return;
  }

  await prisma.channel.delete({
    where: {
      id: trueId,
    },
  });
  revalidatePath("/channels");
}

