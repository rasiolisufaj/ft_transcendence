import { createHash, randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { prisma } from "@/lib/db";

const ISSUER = "MesPapiers";
const RECOVERY_CODE_COUNT = 10;

export function createSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function otpauthUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateRecoveryCodes(): { codes: string[]; digests: string[] } {
  const codes: string[] = [];
  const digests: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = randomBytes(5).toString("hex");
    codes.push(code);
    digests.push(hashRecoveryCode(code));
  }
  return { codes, digests };
}

export async function consumeRecoveryCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const digest = hashRecoveryCode(code);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { recoveryCodes: true },
  });
  if (!user) return false;

  const idx = user.recoveryCodes.indexOf(digest);
  if (idx === -1) return false;

  const remaining = [...user.recoveryCodes];
  remaining.splice(idx, 1);
  await prisma.user.update({
    where: { id: userId },
    data: { recoveryCodes: remaining },
  });
  return true;
}

export async function enableTotp(
  userId: string,
  secret: string,
  recoveryCodes: string[],
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: secret,
      totpEnabled: true,
      recoveryCodes,
    },
  });
}

export async function disableTotp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpEnabled: false,
      recoveryCodes: [],
    },
  });
}

export async function markTwoFactorVerified(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { twoFactorVerified: true, twoFactorVerifiedAt: new Date() },
  });
}
