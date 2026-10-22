import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { isUserId, relationBetween } from "./profile";

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

  it("is none for a pending request", async () => {
    await prisma.friendship.create({ data: { requesterId: a, receiverId: b } });
    expect(await relationBetween(a, b)).toBe("none");
  });

  it("is blocked for the user who was blocked, not only for the blocker", async () => {
    await prisma.friendship.create({ data: { requesterId: a, receiverId: b, status: "BLOCKED" } });
    expect(await relationBetween(b, a)).toBe("blocked");
  });
});
