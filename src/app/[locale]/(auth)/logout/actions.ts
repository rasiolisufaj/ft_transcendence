"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { clearSessionCookie, getCurrentUser, invalidateSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function logout(): Promise<void> {
  const ctx = await getCurrentUser();
  if (ctx) {
    await invalidateSession(ctx.session.id);
    // Offline at once, not 5 minutes later. Another open session stamps it again on its next request.
    await prisma.user.updateMany({ where: { id: ctx.user.id }, data: { lastSeenAt: null } });
  }
  await clearSessionCookie();
  redirect({ href: "/login", locale: await getLocale() });
}
