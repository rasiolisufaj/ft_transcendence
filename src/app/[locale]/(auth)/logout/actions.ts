"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { clearSessionCookie, getCurrentUser, invalidateSession } from "@/lib/auth/session";

export async function logout(): Promise<void> {
  const ctx = await getCurrentUser();
  if (ctx) await invalidateSession(ctx.session.id);
  await clearSessionCookie();
  redirect({ href: "/login", locale: await getLocale() });
}
