import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, getCurrentUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GET } from "./route";

// getCurrentUser() reads the cookie; the context it returns is still a real one.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getCurrentUser: vi.fn(),
}));

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const get = (id: string) =>
  GET(new Request(`https://mespapiers.local/api/users/${id}/avatar`), {
    params: Promise.resolve({ id }),
  });

describe("GET /api/users/[id]/avatar", () => {
  let userId: string;

  beforeEach(async () => {
    userId = (
      await prisma.user.create({
        data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test" },
      })
    ).id;
    const { token } = await createSession(userId);
    vi.mocked(getCurrentUser).mockResolvedValue(await validateSessionToken(token));
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("answers 401 without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await get(userId)).status).toBe(401);
  });

  it("answers 404 when the user has no avatar, or for an id that is no user id", async () => {
    expect((await get(userId)).status).toBe(404);
    expect((await get("bad\0id")).status).toBe(404);
  });

  it("serves the stored bytes with their type, nosniff and no-store", async () => {
    await prisma.userAvatar.create({ data: { userId, data: PNG, mimeType: "image/png" } });

    const res = await get(userId);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });
});
