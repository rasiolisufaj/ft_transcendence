import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { deleteAccount } from "./actions";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  redirect: vi.fn(),
}));

const PASSWORD = "correct-password";

function form(password: string): FormData {
  const f = new FormData();
  f.set("password", password);
  return f;
}

async function newUser(globalRole: "USER" | "ADMIN") {
  return prisma.user.create({
    data: {
      email: `test-${randomUUID()}@mespapiers.test`,
      displayName: "Test",
      globalRole,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
}

async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

const auditRows = (targetId: string) => prisma.auditLog.findMany({ where: { targetId } });

describe("deleteAccount", () => {
  let admin: { id: string };
  let user: { id: string };

  beforeEach(async () => {
    admin = await newUser("ADMIN");
    user = await newUser("USER");
  });

  afterEach(async () => {
    const ids = [admin.id, user.id];
    await prisma.auditLog.deleteMany({ where: { targetId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("refuses a wrong password and changes nothing", async () => {
    await signInAs(user.id);

    await expect(deleteAccount({}, form("wrong"))).resolves.toEqual({ error: "wrongPassword" });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await auditRows(user.id)).toEqual([]);
  });

  it("refuses the last admin", async () => {
    await signInAs(admin.id);

    await expect(deleteAccount({}, form(PASSWORD))).resolves.toEqual({ error: "lastAdmin" });
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
  });

  it("does not refuse an admin when another admin exists", async () => {
    const secondAdmin = await newUser("ADMIN");
    await signInAs(admin.id);

    await deleteAccount({}, form(PASSWORD));

    expect(await prisma.user.findUnique({ where: { id: admin.id } })).toBeNull();
    await prisma.user.deleteMany({ where: { id: secondAdmin.id } });
  });

  it("locks after 6 failed attempts", async () => {
    await signInAs(user.id);

    for (let i = 0; i < 6; i++) {
      await expect(deleteAccount({}, form("wrong"))).resolves.toEqual({ error: "wrongPassword" });
    }
    await expect(deleteAccount({}, form(PASSWORD))).resolves.toEqual({ error: "tooManyAttempts" });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("deletes the account, audits it and clears the session", async () => {
    await signInAs(user.id);

    await deleteAccount({}, form(PASSWORD));

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await auditRows(user.id)).toEqual([
      expect.objectContaining({ actorUserId: null, action: "gdpr:delete", targetType: "User" }),
    ]);
  });
});
