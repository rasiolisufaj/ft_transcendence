import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { ChannelRole, GlobalRole } from "@/generated/prisma/client";

export const SESSION_COOKIE = "mp_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;      // 30 days
const RENEW_WHEN_LESS_THAN_MS = SESSION_TTL_MS / 2;   // slide past the halfway point

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarKey: string | null;
  locale: string;          // becomes Locale when Alexandre ships D10 — §C-7
  totpEnabled: boolean;
  globalRole: GlobalRole;
  reputation: number;
};

export type SessionContext = {
  session: { id: string; expiresAt: Date; twoFactorVerified: boolean };
  user: SessionUser;
  /** Loaded here because can() is synchronous and cannot query — §C-6. */
  memberships: { channelId: number; role: ChannelRole }[];
};

/** 192 bits, base64url so it is safe in a cookie with no encoding. */
export function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The token the browser holds is never stored. Only this digest is, as Session.id. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionContext | null> {
  const id = hashToken(token);
  const row = await prisma.session.findUnique({
    where: { id },
    include: {
      user: {
        include: { channelMemberships: { select: { channelId: true, role: true } } },
      },
    },
  });
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  let { expiresAt } = row;
  if (expiresAt.getTime() - Date.now() < RENEW_WHEN_LESS_THAN_MS) {
    expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({ where: { id }, data: { expiresAt } });
  }

  const { user } = row;
  return {
    session: { id: row.id, expiresAt, twoFactorVerified: row.twoFactorVerified },
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarKey: user.avatarKey,
      locale: user.locale,
      totpEnabled: user.totpEnabled,
      globalRole: user.globalRole,
      reputation: user.reputation,
    },
    memberships: user.channelMemberships,
  };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
