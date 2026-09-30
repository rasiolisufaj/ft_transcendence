import type { Messages } from "next-intl";
import { z } from "zod";

/** Every error message below is a key of `auth.errors` in messages/*.json. */
export type AuthErrorKey = keyof Messages["auth"]["errors"];

// Normalise BEFORE validating: a check sees the value as it is at its place in
// the chain, so `z.email().trim()` would reject "  A@b.com " before trimming.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "emailInvalid")
  .pipe(z.email("emailInvalid"));

export const signupSchema = z.object({
  email: emailField,
  displayName: z.string().trim().min(2, "displayNameTooShort").max(50, "displayNameTooLong"),
  password: z.string().min(8, "passwordTooShort").max(200, "passwordTooLong"),
});
export type SignupInput = z.infer<typeof signupSchema>;

// Deliberately looser than signupSchema: login checks identity, not policy.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "passwordRequired"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * What every auth Server Action returns to useActionState. It lives here, not
 * in an action file, because a "use server" module may only export async functions.
 */
export type AuthFormState = {
  error?: AuthErrorKey;
  fieldErrors?: Record<string, AuthErrorKey[] | undefined>;
};
