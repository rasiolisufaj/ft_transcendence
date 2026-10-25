import type { Messages } from "next-intl";
import { z } from "zod";
import { displayNameField, type AuthErrorKey } from "@/lib/auth/schemas";

/** The profile form and updateProfile both import this (plan §0: one schema module per form). */
export const profileSchema = z.object({ displayName: displayNameField });

/**
 * What updateProfile returns to useActionState. It lives here, not in the actions file,
 * because a "use server" module may only export async functions.
 */
export type ProfileFormState = {
  fieldErrors?: { displayName?: AuthErrorKey[] };
  saved?: boolean;
};

/** The `accept` list of the file input; the server decides by the bytes (sniffMime). */
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Every avatar error is a key of `profile.errors` in messages/*.json. */
export type AvatarErrorKey = keyof Messages["profile"]["errors"];

/** The size only: file.type is the client's word, so the type is decided by sniffMime. */
export const avatarSchema = z
  .file({ error: "avatarMissing" })
  .min(1, "avatarMissing")
  .max(AVATAR_MAX_BYTES, "avatarTooBig");

/** What uploadAvatar returns to useActionState. */
export type AvatarFormState = { error?: AvatarErrorKey; saved?: boolean };
