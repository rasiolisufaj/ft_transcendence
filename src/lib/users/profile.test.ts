import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { isOnline, isUserId, relationBetween } from "./profile";

const newUser = () =>
  prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test" },
  });

describe("isUserId", () => {
  it("accepts a cuid and refuses anything Postgres could choke on", () => {
    expect(isUserId("cmgx1k2ab0000qz8h3v5w7y9t")).toBe(true);
    expect(isUserId("bad\0id")).toBe(false);
    expect(isUserId("../etc")).toBe(false);
    expect(isUserId("")).toBe(false);
  });
});

describe("isOnline", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("is true up to 5 minutes after the last request, false after", () => {
    expect(isOnline(ago(4 * 60_000 + 59_000), now)).toBe(true);
    expect(isOnline(ago(5 * 60_000 + 1_000), now)).toBe(false);
  });

  it("is false for someone never seen", () => {
    expect(isOnline(null, now)).toBe(false);
  });
});

describe("relationBetween", () => {
  let a: string;
  let b: string;

  beforeEach(async () => {
    a = (await newUser()).id;
    b = (await newUser()).id;
  });

  // Friendship cascades from User.
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [a, b] } } });
  });

  it("is friend for an accepted request, seen from the receiver's side", async () => {
    await prisma.friendship.create({ data: { requesterId: a, receiverId: b, status: "ACCEPTED" } });
    expect(await relationBetween(b, a)).toBe("friend");
  });

  it("is none with no row, then pending once a request is sent, from either side", async () => {
    expect(await relationBetween(a, b)).toBe("none");
    await prisma.friendship.create({ data: { requesterId: a, receiverId: b } });
    expect(await relationBetween(b, a)).toBe("pending");
  });

  it("is blocked for the user who was blocked, not only for the blocker", async () => {
    await prisma.friendship.create({ data: { requesterId: a, receiverId: b, status: "BLOCKED" } });
    expect(await relationBetween(b, a)).toBe("blocked");
  });
});
