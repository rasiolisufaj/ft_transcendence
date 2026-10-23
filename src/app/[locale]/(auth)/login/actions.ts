"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { loginSchema, type AuthErrorKey, type AuthFormState } from "@/lib/auth/schemas";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const loginLimiter = createRateLimiter();

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
  }

  const { email, password } = parsed.data;

  if (loginLimiter.tooManyAttempts(email)) {
    return { error: "tooManyAttempts" };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // One message for "no such user" and "wrong password", otherwise the form
  // tells anyone which email addresses are registered.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    loginLimiter.recordFailure(email);
    return { error: "invalidCredentials" };
  }

  loginLimiter.clearAttempts(email);

  // A new Session row and a new cookie on every login: the session id rotates (C11).
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  // `return`: TS only sees redirect() as never-returning with an explicit type.
  return redirect({ href: "/", locale: await getLocale() });
}
