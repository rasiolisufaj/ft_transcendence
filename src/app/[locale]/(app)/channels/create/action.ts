"use server";

import { prisma } from "@/lib/db";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";

export async function createChannel(formData: FormData) {
  const nameChannel = formData.get("name");
  const descriptionChannel = formData.get("description");
  const answer = formData.get("question");
  const visibilityChannel = formData.get("visibility");
  let boolvisibility : boolean= false;
  // Check that the channel name is not empty
  // and does not contain only spaces.
  if (typeof nameChannel !== "string" || typeof visibilityChannel !== "string" || !nameChannel || !visibilityChannel) {
    return;
  }

  const trueVisibilityChannel : string = visibilityChannel.trim();
  const trueNameChannel: string = nameChannel.trim();
  if (trueNameChannel.length === 0 || visibilityChannel.length === 0) {
    return;
  } else if (trueNameChannel.length >= 100 || trueVisibilityChannel.length >= 8) {
    return;
  }

  if(trueVisibilityChannel === "public")
    boolvisibility = false;
  else if (trueVisibilityChannel === "private")
    boolvisibility = true;
  else
    return;

  if (typeof answer !== "string" || !answer) {
    return;
  }

  const trueQuestion: string = answer.trim();
  if (trueQuestion.length === 0) {
    return;
  } else if (trueQuestion.length > 300) {
    return;
  }

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

  const { user } = await requireUser();

  const existingChannel = await prisma.channel.findFirst({
    where: { title: { equals: trueNameChannel, mode: "insensitive" } },
  });
  if (existingChannel) {
    return;
  }

  await prisma.channel.create({
    data: {
      createdBy: user.id,
      title: trueNameChannel,
      description: cleanDescription,
      isPrivate: boolvisibility,
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
