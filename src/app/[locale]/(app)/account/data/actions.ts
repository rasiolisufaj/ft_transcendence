"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
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

  const deleted = await prisma.$transaction(async (tx) => {
    // FOR UPDATE locks the admin rows: when the last two admins delete themselves at
    // once, the second waits for the first, then sees it is the last one.
    const admins = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE "globalRole" = 'ADMIN' FOR UPDATE`;
    if (admins.length === 1 && admins[0]?.id === user.id) return null;
    return (await tx.user.deleteMany({ where: { id: user.id } })).count;
  });
  if (deleted === null) {
    return { error: "lastAdmin" };
  }

  const locale = await getLocale();
  // 0 rows: a concurrent submit deleted the account first, and already mailed and audited.
  if (deleted > 0) {
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
  }

  await clearSessionCookie();
  return redirect({ href: "/login", locale });
}
