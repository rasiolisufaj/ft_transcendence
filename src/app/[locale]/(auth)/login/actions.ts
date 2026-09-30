"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema, type AuthErrorKey, type AuthFormState } from "@/lib/auth/schemas";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

// C11: 6 failures per 15 minutes per email lock the form. One web process, so an
// in-memory Map is enough (a restart clears it); Redis would be infrastructure
// for a problem this project does not have.
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function tooManyAttempts(email: string): boolean {
  const entry = attempts.get(email);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(email: string): void {
  const now = Date.now();
  // Drop expired windows, so a spray of made-up emails cannot grow the Map forever.
  for (const [key, entry] of attempts) if (now - entry.firstAt > WINDOW_MS) attempts.delete(key);
  const entry = attempts.get(email);
  if (entry) entry.count += 1;
  else attempts.set(email, { count: 1, firstAt: now });
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
  }

  const { email, password } = parsed.data;

  if (tooManyAttempts(email)) {
    return { error: "tooManyAttempts" };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // One message for "no such user" and "wrong password", otherwise the form
  // tells anyone which email addresses are registered.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    recordFailure(email);
    return { error: "invalidCredentials" };
  }

  attempts.delete(email);

  // A new Session row and a new cookie on every login: the session id rotates (C11).
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  // `return`: TS only sees redirect() as never-returning with an explicit type.
  return redirect({ href: "/", locale: await getLocale() });
}
