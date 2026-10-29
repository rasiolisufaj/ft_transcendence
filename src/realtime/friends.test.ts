import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { friendsOf } from "@/realtime/friends";

let me: string;
let others: string[];

async function createUser() {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Alice" },
  });
  return user.id;
}

beforeEach(async () => {
  me = await createUser();
  others = [await createUser(), await createUser(), await createUser()];
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [me, ...others] } } });
});

describe("friendsOf", () => {
  it("finds accepted friends in both directions", async () => {
    const [a, b] = others as [string, string];
    await prisma.friendship.create({ data: { requesterId: me, receiverId: a, status: "ACCEPTED" } });
    await prisma.friendship.create({ data: { requesterId: b, receiverId: me, status: "ACCEPTED" } });

    expect((await friendsOf(me)).sort()).toEqual([a, b].sort());
  });

  it("skips pending and blocked friendships", async () => {
    const [a, b] = others as [string, string];
    await prisma.friendship.create({ data: { requesterId: me, receiverId: a, status: "PENDING" } });
    await prisma.friendship.create({ data: { requesterId: b, receiverId: me, status: "BLOCKED" } });

    expect(await friendsOf(me)).toEqual([]);
  });

  it("is empty for someone without friends", async () => {
    expect(await friendsOf(me)).toEqual([]);
  });
});
