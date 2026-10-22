"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { AuthErrorKey } from "@/lib/auth/schemas";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendRequest } from "@/lib/friends/friendships";
import { isUserId } from "@/lib/users/profile";
import { profileSchema, type ProfileFormState } from "@/lib/users/schemas";

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
