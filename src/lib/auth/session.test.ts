import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createSession,
  generateSessionToken,
  hashToken,
  invalidateAllSessions,
  invalidateSession,
  validateSessionToken,
} from "@/lib/auth/session";

describe("session tokens", () => {
  it("generates a URL-safe token with at least 128 bits of entropy", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(22);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, generateSessionToken));
    expect(seen.size).toBe(500);
  });

  it("hashes deterministically to 64 hex chars", () => {
    const token = generateSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});

describe("session lifecycle", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test" },
    });
    userId = user.id;
  });

  // Session, ChannelMember and AuditLog all cascade from User.
  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("stores the raw token in no column", async () => {
    const { token } = await createSession(userId);
    const row = await prisma.session.findFirst({ where: { userId } });
    expect(row).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row!.id).toBe(hashToken(token));
  });

  it("validates a fresh token into a full context", async () => {
    const { token } = await createSession(userId);
    const ctx = await validateSessionToken(token);
    expect(ctx?.user.id).toBe(userId);
    expect(ctx?.user.globalRole).toBe("USER");
    expect(ctx?.session.twoFactorVerified).toBe(false);
    expect(ctx?.memberships).toEqual([]);
  });

  it("rejects a token that was never issued", async () => {
    expect(await validateSessionToken("not-a-real-token")).toBeNull();
  });

  it("rejects an expired session and deletes the row", async () => {
    const { token } = await createSession(userId);
    await prisma.session.update({
      where: { id: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).toBeNull();
  });

  it("slides the expiry when the session is past its halfway point", async () => {
    const { token } = await createSession(userId);
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day left of 30
    await prisma.session.update({ where: { id: hashToken(token) }, data: { expiresAt: soon } });

    const ctx = await validateSessionToken(token);
    expect(ctx!.session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
  });

  it("invalidates one session and leaves the others alone", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    await invalidateSession(hashToken(a.token));
    expect(await validateSessionToken(a.token)).toBeNull();
    expect(await validateSessionToken(b.token)).not.toBeNull();
  });

  it("invalidates every session of one user", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    await invalidateAllSessions(userId);
    expect(await validateSessionToken(a.token)).toBeNull();
    expect(await validateSessionToken(b.token)).toBeNull();
  });

  it("carries channel memberships into the context", async () => {
    const channel = await prisma.channel.create({
      data: { title: "Test channel", createdBy: userId },
    });
    await prisma.channelMember.create({
      data: { channelId: channel.id, userId, role: "MODERATOR" },
    });
    const { token } = await createSession(userId);
    const ctx = await validateSessionToken(token);
    expect(ctx?.memberships).toEqual([{ channelId: channel.id, role: "MODERATOR" }]);
    await prisma.channel.delete({ where: { id: channel.id } });
  });
});
