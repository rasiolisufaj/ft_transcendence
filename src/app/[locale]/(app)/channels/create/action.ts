"use server";

import { prisma } from "@/lib/db";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { Prisma } from "@/generated/prisma/client";

export type CreateChannelState = {
  error?:
    | "nameEmpty"
    | "nameTooLong"
    | "nameTaken"
    | "descriptionTooLong"
    | "questionEmpty"
    | "questionTooLong"
    | "visibilityMissing";
};

export async function createChannel(
  _prev: CreateChannelState,
  formData: FormData,
): Promise<CreateChannelState> {
  const ctx = await requireUser();
  assertCan(ctx, "channel:create");
  const { user } = ctx;

  const nameChannel = formData.get("name");
  if (typeof nameChannel !== "string") return { error: "nameEmpty" };

  const trueNameChannel = nameChannel.trim();
  if (trueNameChannel.length === 0) return { error: "nameEmpty" };
  if (trueNameChannel.length > 100) return { error: "nameTooLong" };

  const visibilityChannel = formData.get("visibility");
  if (typeof visibilityChannel !== "string") return { error: "visibilityMissing" };

  const trueVisibilityChannel = visibilityChannel.trim();
  let boolvisibility: boolean;
  if (trueVisibilityChannel === "public") {
    boolvisibility = false;
  } else if (trueVisibilityChannel === "private") {
    boolvisibility = true;
  } else {
    return { error: "visibilityMissing" };
  }

  const answer = formData.get("question");
  if (typeof answer !== "string") return { error: "questionEmpty" };

  const trueQuestion = answer.trim();
  if (trueQuestion.length === 0) return { error: "questionEmpty" };
  if (trueQuestion.length > 300) return { error: "questionTooLong" };

  const descriptionChannel = formData.get("description");
  let cleanDescription: string | null = null;
  if (typeof descriptionChannel === "string") {
    const truedescriptionChannel = descriptionChannel.trim();
    if (truedescriptionChannel.length > 250) {
      return { error: "descriptionTooLong" };
    }
    if (truedescriptionChannel.length > 0) {
      cleanDescription = truedescriptionChannel;
    }
  }

  let channelId: number;
  try {
    const created = await prisma.channel.create({
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
    channelId = created.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "nameTaken" };
    }
    throw error;
  }

  return redirect({ href: `/channels/${channelId}`, locale: await getLocale() });
}
