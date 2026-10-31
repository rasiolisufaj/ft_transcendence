"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import {
  createSecret,
  disableTotp,
  enableTotp,
  generateRecoveryCodes,
  otpauthUri,
  verifyCode,
} from "@/lib/auth/totp";
import { prisma } from "@/lib/db";

export type SetupState = {
  step: "idle" | "setup" | "recovery";
  secret?: string;
  uri?: string;
  recoveryCodes?: string[];
  error?: string;
};

export async function startSetup(): Promise<SetupState> {
  const ctx = await requireUser();
  if (ctx.user.totpEnabled) return { step: "idle", error: "alreadyEnabled" };

  const secret = createSecret();
  const uri = otpauthUri(secret, ctx.user.email);
  return { step: "setup", secret, uri };
}

export async function confirmSetup(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const ctx = await requireUser();
  const secret = formData.get("secret") as string | null;
  const code = (formData.get("code") as string | null)?.trim() ?? "";

  if (!secret || !code) return { step: "setup", secret: secret ?? "", error: "codeRequired" };

  if (!verifyCode(secret, code.replace(/\s/g, ""))) {
    return { step: "setup", secret, uri: otpauthUri(secret, ctx.user.email), error: "invalidCode" };
  }

  const { codes, digests } = generateRecoveryCodes();
  await enableTotp(ctx.user.id, secret, digests);
  await writeAudit({ actorUserId: ctx.user.id, action: "totp:enable", targetType: "user", targetId: ctx.user.id });
  return { step: "recovery", recoveryCodes: codes };
}

export type DisableState = { error?: string; success?: boolean };

export async function disableTwoFactor(
  _prev: DisableState,
  formData: FormData,
): Promise<DisableState> {
  const ctx = await requireUser();
  if (!ctx.user.totpEnabled) return { error: "notEnabled" };

  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!code) return { error: "codeRequired" };

  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { totpSecret: true },
  });
  if (!user?.totpSecret) return { error: "notEnabled" };

  if (!verifyCode(user.totpSecret, code.replace(/\s/g, ""))) {
    return { error: "invalidCode" };
  }

  await disableTotp(ctx.user.id);
  await writeAudit({ actorUserId: ctx.user.id, action: "totp:disable", targetType: "user", targetId: ctx.user.id });
  revalidatePath("/account/security");
  return { success: true };
}
