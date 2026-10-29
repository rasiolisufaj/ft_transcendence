"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { sendMessage } from "@/lib/messages/messages";
import { sendMessageSchema, type MessageErrorKey, type MessageFormState } from "@/lib/messages/schemas";

// The sender is the session user, never a form field.
export async function sendMessageAction(_prev: MessageFormState, formData: FormData): Promise<MessageFormState> {
  const { user } = await requireUser();

  const parsed = sendMessageSchema.safeParse({ userId: formData.get("userId"), content: formData.get("content") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const error: MessageErrorKey = issue?.path[0] === "content" ? (issue.message as MessageErrorKey) : "notFriends";
    return { error };
  }

  const result = await sendMessage(user.id, parsed.data.userId, parsed.data.content);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/[locale]/(app)/messages", "layout");
  return {};
}
