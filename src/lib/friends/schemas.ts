import { z } from "zod";
import type { FriendError } from "./friendships";

// Shared by the form and the actions. Errors are keys of friends.errors.

export type FriendErrorKey = FriendError | "emailInvalid";

export const addFriendSchema = z.object({
  // Normalise before validating, like signup.
  email: z.string().trim().toLowerCase().max(254, "emailInvalid").pipe(z.email("emailInvalid")),
});

export const otherUserSchema = z.object({
  userId: z.string().min(1).max(64),
});

// Here, not in actions.ts: a "use server" file only exports async functions.
export type FriendFormState = {
  error?: FriendErrorKey;
  sent?: boolean;
};
