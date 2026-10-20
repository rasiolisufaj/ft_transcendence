"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { defaultLocale, isLocale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, requireUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import type { AuthErrorKey } from "@/lib/auth/schemas";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";
import { deleteAccountSchema } from "./schemas";

const deleteLimiter = createRateLimiter();

export type DeleteAccountState = {
  error?: "wrongPassword" | "lastAdmin" | "tooManyAttempts";
  fieldErrors?: Record<string, AuthErrorKey[] | undefined>;
};

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const ctx = await requireUser();
  assertCan(ctx, "gdpr:delete");
  const { user } = ctx;

  const parsed = deleteAccountSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
  }
  const { password } = parsed.data;

  if (user.globalRole === "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { globalRole: "ADMIN", id: { not: user.id } },
    });
    if (otherAdmins === 0) {
      return { error: "lastAdmin" };
    }
  }

  if (deleteLimiter.tooManyAttempts(user.id)) {
    return { error: "tooManyAttempts" };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!account?.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
    deleteLimiter.recordFailure(user.id);
    return { error: "wrongPassword" };
  }
  deleteLimiter.clearAttempts(user.id);

  await prisma.user.deleteMany({ where: { id: user.id } });

  const locale = isLocale(user.locale) ? user.locale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "myData" });
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
  await sendMail(user.email, t("deleteMailSubject"), t("deleteMailBody", { date }));

  await writeAudit({
    actorUserId: null,
    action: "gdpr:delete",
    targetType: "User",
    targetId: user.id,
  });

  await clearSessionCookie();
  return redirect({ href: "/login", locale: await getLocale() });
}
