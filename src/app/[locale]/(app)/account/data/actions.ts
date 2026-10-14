"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, requireUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/policy";
import { writeAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail";

export type DeleteAccountState = { error?: "wrongPassword" };

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const ctx = await requireUser();
  assertCan(ctx, "gdpr:delete");
  const { user } = ctx;

  const password = formData.get("password");
  if (typeof password !== "string" || password === "") {
    return { error: "wrongPassword" };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!account?.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
    return { error: "wrongPassword" };
  }

  await prisma.user.deleteMany({ where: { id: user.id } });

  await sendMail(
    user.email,
    "MesPapiers - Votre compte a été supprimé",
    `Bonjour,\n\nVotre compte MesPapiers et vos documents ont été supprimés définitivement le ${new Date().toLocaleString("fr-FR")}.\n\nVos réponses dans les channels restent visibles, mais sans votre nom.\n\nL'équipe MesPapiers`,
  );

  await writeAudit({
    actorUserId: null,
    action: "gdpr:delete",
    targetType: "User",
    targetId: user.id,
  });

  await clearSessionCookie();
  return redirect({ href: "/login", locale: await getLocale() });
}