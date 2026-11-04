"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import {
  createSession,
  getPendingTwoFactorSession,
  hashToken,
  invalidateSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { consumeRecoveryCode, markTwoFactorVerified, verifyCode } from "@/lib/auth/totp";

const twoFactorLimiter = createRateLimiter();

export type TwoFactorState = { error?: "tooManyAttempts" | "codeRequired" | "invalidCode" };

export async function verifyTwoFactor(
  _prev: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const ctx = await getPendingTwoFactorSession();
  if (!ctx) return redirect({ href: "/login", locale: await getLocale() });

  if (twoFactorLimiter.tooManyAttempts(ctx.user.id)) {
    return { error: "tooManyAttempts" };
  }

  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!code) return { error: "codeRequired" };

  twoFactorLimiter.recordFailure(ctx.user.id);

  const secret = await getSecret(ctx.user.id);
  if (!secret) return redirect({ href: "/login", locale: await getLocale() });

  const plain = code.replace(/\s/g, "");
  const isRecovery = plain.length === 10 && /^[0-9a-f]{10}$/.test(plain);
  let valid = false;

  if (isRecovery) {
    valid = await consumeRecoveryCode(ctx.user.id, plain);
  } else {
    valid = verifyCode(secret, plain);
  }

  if (!valid) {
    return { error: "invalidCode" };
  }

  twoFactorLimiter.clearAttempts(ctx.user.id);
  // A new session for the new privilege, as login does (C11). Its Set-Cookie also makes Next send
  // the whole page back: a redirect alone is a client navigation that keeps the root layout, so
  // the nav would still show the signed-out links.
  const { token, expiresAt } = await createSession(ctx.user.id);
  await markTwoFactorVerified(hashToken(token));
  await setSessionCookie(token, expiresAt);
  await invalidateSession(ctx.session.id);
  return redirect({ href: "/", locale: await getLocale() });
}

async function getSecret(userId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });
  return user?.totpSecret ?? null;
}
