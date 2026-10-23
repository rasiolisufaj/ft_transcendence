"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { AuthErrorKey } from "@/lib/auth/schemas";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sniffMime } from "@/lib/files/sniff";
import { sendRequest } from "@/lib/friends/friendships";
import { isUserId } from "@/lib/users/profile";
import {
  AVATAR_TYPES,
  avatarSchema,
  profileSchema,
  type AvatarErrorKey,
  type AvatarFormState,
  type ProfileFormState,
} from "@/lib/users/schemas";

/** Changes the caller's own display name. The id comes from the session, never from the form. */
export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const ctx = await requireUser();

  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
  }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { displayName: parsed.data.displayName },
  });
  // Re-renders this page and the root layout's Nav, which shows the name.
  refresh();
  return { saved: true };
}

/**
 * Sends a friend request from the caller to the profile's owner. The requester comes from
 * the session; sendRequest refuses yourself and a block (either way) and ignores a repeat.
 */
export async function addFriendFromProfile(formData: FormData): Promise<void> {
  const ctx = await requireUser();
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !isUserId(userId)) return;

  await sendRequest(ctx.user.id, userId);
  // The page re-renders: the button becomes "Demande d'ami en attente".
  refresh();
}

/** Stores the caller's avatar, replacing the previous one (one row per user). */
export async function uploadAvatar(
  _prev: AvatarFormState,
  formData: FormData,
): Promise<AvatarFormState> {
  const ctx = await requireUser();

  const parsed = avatarSchema.safeParse(formData.get("avatar"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message as AvatarErrorKey };
  }

  // The bytes decide the type: a renamed SVG, HTML or PDF file is refused here.
  const data = Buffer.from(await parsed.data.arrayBuffer());
  const mimeType = sniffMime(data);
  if (!mimeType || !(AVATAR_TYPES as readonly string[]).includes(mimeType)) {
    return { error: "avatarType" };
  }

  await prisma.userAvatar.upsert({
    where: { userId: ctx.user.id },
    create: { userId: ctx.user.id, data, mimeType },
    update: { data, mimeType },
  });
  refresh();
  return { saved: true };
}
