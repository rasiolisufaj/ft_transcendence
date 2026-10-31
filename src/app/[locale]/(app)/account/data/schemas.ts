import { z } from "zod";
import { emailField } from "@/lib/auth/schemas";

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "passwordRequired").max(200, "passwordTooLong"),
});

// An account made by Google sign-in (phase 8) has no password: it confirms with its email.
export const deleteWithEmailSchema = z.object({ email: emailField });
