"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  acceptRequest,
  block,
  cancelRequest,
  declineRequest,
  findUserIdByEmail,
  removeFriend,
  sendRequest,
  unblock,
  type Result,
} from "@/lib/friends/friendships";
import { addFriendSchema, otherUserSchema, type FriendFormState } from "@/lib/friends/schemas";

// Each action checks the session: the (app) layout is not a security boundary.

export async function addFriend(_prev: FriendFormState, formData: FormData): Promise<FriendFormState> {
  const { user } = await requireUser();

  const parsed = addFriendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "emailInvalid" };
  }

  const otherId = await findUserIdByEmail(parsed.data.email);
  if (!otherId) {
    return { error: "notFound" };
  }

  const result = await sendRequest(user.id, otherId);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/[locale]/friends", "page");
  return { sent: true };
}

// Shared by every per-person button.
async function onOtherUser(
  formData: FormData,
  run: (me: string, other: string) => Promise<Result>,
): Promise<void> {
  const { user } = await requireUser();

  const parsed = otherUserSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) {
    return;
  }

  await run(user.id, parsed.data.userId);
  revalidatePath("/[locale]/friends", "page");
}

export async function acceptFriend(formData: FormData) {
  await onOtherUser(formData, acceptRequest);
}

export async function declineFriend(formData: FormData) {
  await onOtherUser(formData, declineRequest);
}

export async function cancelFriendRequest(formData: FormData) {
  await onOtherUser(formData, cancelRequest);
}

export async function removeFriendAction(formData: FormData) {
  await onOtherUser(formData, removeFriend);
}

export async function blockUser(formData: FormData) {
  await onOtherUser(formData, block);
}

export async function unblockUser(formData: FormData) {
  await onOtherUser(formData, unblock);
}
