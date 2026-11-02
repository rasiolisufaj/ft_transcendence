"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { markAllRead, openNotification } from "@/lib/notifications/notifications";

const INT4_MAX = 2_147_483_647;
const idSchema = z.coerce.number().int().positive().max(INT4_MAX);

export async function markAllReadAction(): Promise<void> {
  const { user } = await requireUser();
  await markAllRead(user.id);
  // The layout too: the bell's count lives in the nav.
  revalidatePath("/[locale]", "layout");
}

// The link comes from the notification, never from the form.
export async function openNotificationAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  const href = id.success ? await openNotification(user.id, id.data) : "/notifications";
  revalidatePath("/[locale]", "layout");
  redirect({ href, locale: await getLocale() });
}
