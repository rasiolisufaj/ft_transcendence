import { z } from "zod";
import type { MessageError } from "./messages";

// Shared by the form and the action. Errors are keys of chat.errors.

export const MAX_MESSAGE_LENGTH = 1000;

export type MessageErrorKey = MessageError | "empty" | "tooLong";

export const sendMessageSchema = z.object({
  userId: z.string().min(1).max(64),
  content: z.string().trim().min(1, "empty").max(MAX_MESSAGE_LENGTH, "tooLong"),
});

// Here, not in actions.ts: a "use server" file only exports async functions.
export type MessageFormState = {
  error?: MessageErrorKey;
};
