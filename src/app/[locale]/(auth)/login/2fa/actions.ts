"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { getPendingTwoFactorSession } from "@/lib/auth/session";
import { consumeRecoveryCode, markTwoFactorVerified, verifyCode } from "@/lib/auth/totp";

const twoFactorLimiter = createRateLimiter();

export type TwoFactorState = { error?: string };

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

  const secret = await getSecret(ctx.user.id);
  if (!secret) return redirect({ href: "/login", locale: await getLocale() });

  const isRecovery = code.length === 10 && /^[0-9a-f]{10}$/.test(code);
  let valid = false;

  if (isRecovery) {
    valid = await consumeRecoveryCode(ctx.user.id, code);
  } else {
    valid = verifyCode(secret, code.replace(/\s/g, ""));
  }

  if (!valid) {
    twoFactorLimiter.recordFailure(ctx.user.id);
    return { error: "invalidCode" };
  }

  twoFactorLimiter.clearAttempts(ctx.user.id);
  await markTwoFactorVerified(ctx.session.id);
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
