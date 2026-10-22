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
