import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  acceptRequest,
  block,
  cancelRequest,
  declineRequest,
  findUserIdByEmail,
  listFriendships,
  removeFriend,
  sendRequest,
  unblock,
} from "@/lib/friends/friendships";

// Real Postgres from .env: `db` must be running.
let alice: string;
let bob: string;
let aliceEmail: string;

async function createUser(name: string) {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: name },
  });
  return user;
}

function rowsBetween(a: string, b: string) {
  return prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: a, receiverId: b },
        { requesterId: b, receiverId: a },
      ],
    },
  });
}

beforeEach(async () => {
  const a = await createUser("Alice");
  const b = await createUser("Bob");
  alice = a.id;
  bob = b.id;
  aliceEmail = a.email;
});

// Friendships are deleted with the users.
afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
});

describe("sendRequest", () => {
  it("creates one pending row", async () => {
    expect(await sendRequest(alice, bob)).toEqual({ ok: true });

    const rows = await rowsBetween(alice, bob);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requesterId: alice, receiverId: bob, status: "PENDING" });
  });

  it("still makes one row after a double click", async () => {
    await sendRequest(alice, bob);
    await sendRequest(alice, bob);

    expect(await rowsBetween(alice, bob)).toHaveLength(1);
  });

  it("makes one row when two clicks arrive at the same time", async () => {
    const results = await Promise.all([sendRequest(alice, bob), sendRequest(alice, bob)]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(await rowsBetween(alice, bob)).toHaveLength(1);
  });

  it("refuses a request to yourself", async () => {
    expect(await sendRequest(alice, alice)).toEqual({ ok: false, error: "self" });
  });

  it("turns crossed requests into one friendship", async () => {
    await sendRequest(alice, bob);
    await sendRequest(bob, alice);

    const rows = await rowsBetween(alice, bob);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ACCEPTED");
  });
});

describe("acceptRequest", () => {
  it("is idempotent under a double click", async () => {
    await sendRequest(alice, bob);

    expect(await acceptRequest(bob, alice)).toEqual({ ok: true });
    expect(await acceptRequest(bob, alice)).toEqual({ ok: true });

    const rows = await rowsBetween(alice, bob);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ACCEPTED");
  });

  it("refuses when there is no request", async () => {
    expect(await acceptRequest(bob, alice)).toEqual({ ok: false, error: "notPending" });
  });

  it("cannot be done by the one who asked", async () => {
    await sendRequest(alice, bob);

    expect(await acceptRequest(alice, bob)).toEqual({ ok: false, error: "notPending" });
  });
});

describe("decline, cancel and remove", () => {
  it("declining deletes the request", async () => {
    await sendRequest(alice, bob);
    await declineRequest(bob, alice);

    expect(await rowsBetween(alice, bob)).toHaveLength(0);
  });

  it("cancelling deletes my request", async () => {
    await sendRequest(alice, bob);
    await cancelRequest(alice, bob);

    expect(await rowsBetween(alice, bob)).toHaveLength(0);
  });

  it("removing a friend works from either side", async () => {
    await sendRequest(alice, bob);
    await acceptRequest(bob, alice);
    await removeFriend(bob, alice);

    expect(await rowsBetween(alice, bob)).toHaveLength(0);
  });
});

describe("block", () => {
  it("replaces the friendship with one blocked row", async () => {
    await sendRequest(alice, bob);
    await acceptRequest(bob, alice);

    await block(alice, bob);

    const rows = await rowsBetween(alice, bob);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requesterId: alice, receiverId: bob, status: "BLOCKED" });
  });

  it("stops requests in both directions", async () => {
    await block(alice, bob);

    expect(await sendRequest(bob, alice)).toEqual({ ok: false, error: "blocked" });
    expect(await sendRequest(alice, bob)).toEqual({ ok: false, error: "blocked" });
  });

  it("hides both people from each other's lists", async () => {
    await sendRequest(bob, alice);
    await block(alice, bob);

    const forAlice = await listFriendships(alice);
    const forBob = await listFriendships(bob);

    expect(forAlice.blocked.map((p) => p.id)).toEqual([bob]);
    expect(forAlice.friends.concat(forAlice.incoming, forAlice.outgoing)).toEqual([]);
    expect(forBob).toEqual({ friends: [], incoming: [], outgoing: [], blocked: [] });
  });

  it("can only be undone by the one who blocked", async () => {
    await block(alice, bob);

    await unblock(bob, alice);
    expect(await rowsBetween(alice, bob)).toHaveLength(1);

    await unblock(alice, bob);
    expect(await rowsBetween(alice, bob)).toHaveLength(0);
  });

  it("refuses to block yourself", async () => {
    expect(await block(alice, alice)).toEqual({ ok: false, error: "self" });
  });
});

describe("listFriendships", () => {
  it("sorts requests into incoming and outgoing", async () => {
    await sendRequest(alice, bob);

    expect((await listFriendships(alice)).outgoing).toEqual([{ id: bob, displayName: "Bob" }]);
    expect((await listFriendships(bob)).incoming).toEqual([{ id: alice, displayName: "Alice" }]);
  });

  it("shows a friend on both sides", async () => {
    await sendRequest(alice, bob);
    await acceptRequest(bob, alice);

    expect((await listFriendships(alice)).friends.map((p) => p.id)).toEqual([bob]);
    expect((await listFriendships(bob)).friends.map((p) => p.id)).toEqual([alice]);
  });
});

describe("findUserIdByEmail", () => {
  it("ignores case and spaces", async () => {
    expect(await findUserIdByEmail(`  ${aliceEmail.toUpperCase()} `)).toBe(alice);
  });

  it("returns null for an unknown email", async () => {
    expect(await findUserIdByEmail(`nobody-${randomUUID()}@mespapiers.test`)).toBeNull();
  });
});
