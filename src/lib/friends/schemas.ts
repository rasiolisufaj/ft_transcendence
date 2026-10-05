import { z } from "zod";
import type { FriendError } from "./friendships";

// Shared by the friends form and its Server Actions (plan §4: one schema module
// for both sides). Every error is a key of friends.errors in messages/*.json.

export type FriendErrorKey = FriendError | "emailInvalid";

export const addFriendSchema = z.object({
  // Same normalising as signup: trim and lowercase BEFORE checking the format.
  email: z.string().trim().toLowerCase().max(254, "emailInvalid").pipe(z.email("emailInvalid")),
});

// The other person, sent as a hidden field by the accept / decline / block... buttons.
export const otherUserSchema = z.object({
  userId: z.string().min(1).max(64),
});

// What addFriend returns to useActionState. It lives here, not in the action
// file, because a "use server" module may only export async functions.
export type FriendFormState = {
  error?: FriendErrorKey;
  sent?: boolean;
};
