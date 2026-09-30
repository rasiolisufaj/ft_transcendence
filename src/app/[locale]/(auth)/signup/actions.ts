"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { hashPassword } from "@/lib/auth/password";
import { signupSchema, type AuthErrorKey, type AuthFormState } from "@/lib/auth/schemas";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
  }

  const { email, displayName, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "emailTaken" };
  }

  const user = await prisma.user.create({
    data: { email, displayName, passwordHash: await hashPassword(password) },
  });

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  // redirect() throws, so it stays last and outside any try. `return` because TS
  // only sees a call as never-returning when the function has an explicit type.
  return redirect({ href: "/", locale: await getLocale() });
}
