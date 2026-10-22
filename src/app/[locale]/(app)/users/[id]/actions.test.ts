import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { updateProfile } from "./actions";

// requireUser() reads the cookie and refresh() needs a Next request, so both are
// replaced. The context the actions get is still a real one, loaded from a real Session row.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const newUser = (displayName: string) =>
  prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName },
  });

async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const nameOf = async (id: string) =>
  (await prisma.user.findUnique({ where: { id } }))?.displayName;

describe("profile actions", () => {
  let me: string;
  let other: string;

  beforeEach(async () => {
    me = (await newUser("Me")).id;
    other = (await newUser("Other")).id;
    await signInAs(me);
  });

  // Session (and, from Task 5, UserAvatar) cascade from User.
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [me, other] } } });
  });

  it("renames the caller only, even with another user's id in the form", async () => {
    const state = await updateProfile({}, form({ displayName: "  New name  ", id: other }));

    expect(state).toEqual({ saved: true });
    expect(await nameOf(me)).toBe("New name");
    expect(await nameOf(other)).toBe("Other");
  });

  it("refuses a name that is one letter once trimmed, and changes nothing", async () => {
    const state = await updateProfile({}, form({ displayName: "   R   " }));

    expect(state.fieldErrors?.displayName).toEqual(["displayNameTooShort"]);
    expect(await nameOf(me)).toBe("Me");
  });
});
