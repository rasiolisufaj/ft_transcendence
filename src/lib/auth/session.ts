import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { ChannelRole, GlobalRole } from "@/generated/prisma/client";

export const SESSION_COOKIE = "mp_session";

// 30 days from login, never extended: the cookie's expiry is fixed at login and
// Next cannot re-set it while rendering, so a longer row would outlive its cookie.
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

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

  const { user } = row;
  return {
    session: { id: row.id, expiresAt: row.expiresAt, twoFactorVerified: row.twoFactorVerified },
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

/** Reads the session cookie. Returns null when absent or invalid. */
export async function getCurrentUser(): Promise<SessionContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

/** The guard. Redirects to /login when there is no valid session. */
export async function requireUser(): Promise<SessionContext> {
  const ctx = await getCurrentUser();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Server Actions and Route Handlers only — Next cannot set cookies while rendering. */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true, // compose runs `next dev` behind nginx TLS; browsers accept Secure on http://localhost
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
