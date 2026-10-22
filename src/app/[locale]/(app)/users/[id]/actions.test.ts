import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AVATAR_MAX_BYTES } from "@/lib/users/schemas";
import { updateProfile, uploadAvatar } from "./actions";

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

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const png = (tail: string) =>
  new File([Buffer.concat([PNG, Buffer.from(tail)])], "me.png", { type: "image/png" });
const avatarOf = (userId: string) => prisma.userAvatar.findUnique({ where: { userId } });

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

  it("stores a png avatar, and a second upload replaces it", async () => {
    expect(await uploadAvatar({}, form({ avatar: png("first") }))).toEqual({ saved: true });
    expect(await uploadAvatar({}, form({ avatar: png("second") }))).toEqual({ saved: true });

    expect(await prisma.userAvatar.count({ where: { userId: me } })).toBe(1);
    const avatar = await avatarOf(me);
    expect(avatar?.mimeType).toBe("image/png");
    expect(Buffer.from(avatar!.data).toString()).toContain("second");
  });

  it("refuses a text file or a PDF named .png, an oversized file and an empty one, storing nothing", async () => {
    const text = new File(["hello"], "fake.png", { type: "image/png" });
    const big = new File([Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES)])], "big.png", {
      type: "image/png",
    });
    const empty = new File([], "empty.png", { type: "image/png" });
    // sniffMime knows PDF too (for documents); an avatar must still be an image.
    const pdf = new File(["%PDF-1.7"], "doc.png", { type: "image/png" });

    expect(await uploadAvatar({}, form({ avatar: text }))).toEqual({ error: "avatarType" });
    expect(await uploadAvatar({}, form({ avatar: pdf }))).toEqual({ error: "avatarType" });
    expect(await uploadAvatar({}, form({ avatar: big }))).toEqual({ error: "avatarTooBig" });
    expect(await uploadAvatar({}, form({ avatar: empty }))).toEqual({ error: "avatarMissing" });
    expect(await avatarOf(me)).toBeNull();
  });
});
