"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { AuthErrorKey } from "@/lib/auth/schemas";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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
