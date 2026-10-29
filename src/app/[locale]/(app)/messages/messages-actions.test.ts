import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendMessageAction } from "./[userId]/actions";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let alice: string;
let bob: string;
let carol: string;

async function createUser(name: string) {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: name },
  });
  return user.id;
}

async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [name, value] of Object.entries(fields)) f.set(name, value);
  return f;
}

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  carol = await createUser("Carol");
  await prisma.friendship.create({ data: { requesterId: alice, receiverId: bob, status: "ACCEPTED" } });
  await signInAs(alice);
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob, carol] } } });
});

describe("sendMessageAction", () => {
  it("sends the message as the signed-in user", async () => {
    expect(await sendMessageAction({}, form({ userId: bob, content: " Salut " }))).toEqual({});

    const messages = await prisma.message.findMany({ where: { senderId: alice } });
    expect(messages.map((m) => m.content)).toEqual(["Salut"]);
  });

  it("refuses someone who is not a friend", async () => {
    expect(await sendMessageAction({}, form({ userId: carol, content: "Salut" }))).toEqual({ error: "notFriends" });
    expect(await prisma.message.count({ where: { senderId: alice } })).toBe(0);
  });

  it("refuses an empty message", async () => {
    expect(await sendMessageAction({}, form({ userId: bob, content: "  " }))).toEqual({ error: "empty" });
  });

  it("refuses a message that is too long", async () => {
    expect(await sendMessageAction({}, form({ userId: bob, content: "x".repeat(1001) }))).toEqual({
      error: "tooLong",
    });
  });

  it("refuses a form without a recipient", async () => {
    expect(await sendMessageAction({}, form({ content: "Salut" }))).toEqual({ error: "notFriends" });
  });
});
