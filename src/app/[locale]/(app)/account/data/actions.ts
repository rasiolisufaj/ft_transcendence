"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, requireUser } from "@/lib/auth/session";

export type DeleteAccountState = { error?: "wrongPassword" };

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const { user } = await requireUser();

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

  await clearSessionCookie();
  return redirect({ href: "/login", locale: await getLocale() });
}