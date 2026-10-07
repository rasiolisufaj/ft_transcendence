import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/auth/policy";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { deleteUser, setGlobalRole } from "./actions";

// requireUser() reads the cookie and revalidatePath() needs a Next request, so
// both are replaced. The context the actions get is still a real one, loaded from
// a real Session row, and the rest of session.ts (invalidateAllSessions) is real.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function newUser(globalRole: GlobalRole) {
  return prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test", globalRole },
  });
}

async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

const roleOf = async (id: string) => (await prisma.user.findUnique({ where: { id } }))?.globalRole;
const auditRows = (targetId: string) => prisma.auditLog.findMany({ where: { targetId } });

describe("admin user actions", () => {
  let admin: { id: string };
  let user: { id: string };

  beforeEach(async () => {
    admin = await newUser("ADMIN");
    user = await newUser("USER");
  });

  afterEach(async () => {
    const ids = [admin.id, user.id];
    // AuditLog.actor is onDelete: SetNull, so deleting the users would leave the rows behind.
    await prisma.auditLog.deleteMany({ where: { targetId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("refuses a non-admin and changes nothing", async () => {
    await signInAs(user.id);

    await expect(setGlobalRole(admin.id, "USER")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteUser(admin.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await roleOf(admin.id)).toBe("ADMIN");
    expect(await auditRows(admin.id)).toEqual([]);
  });

  it("refuses an admin's own role change or deletion", async () => {
    await signInAs(admin.id);

    await expect(setGlobalRole(admin.id, "USER")).rejects.toThrow();
    await expect(deleteUser(admin.id)).rejects.toThrow();
    expect(await roleOf(admin.id)).toBe("ADMIN");
    expect(await auditRows(admin.id)).toEqual([]);
  });

  it("changes a role, audits it and ends that user's sessions", async () => {
    await createSession(user.id);
    await signInAs(admin.id);

    await setGlobalRole(user.id, "ADMIN");

    expect(await roleOf(user.id)).toBe("ADMIN");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await auditRows(user.id)).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: "user:setGlobalRole",
        targetType: "User",
        metadata: { role: "ADMIN" },
      }),
    ]);
  });

  it("deletes a user and audits it", async () => {
    await signInAs(admin.id);

    await deleteUser(user.id);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await auditRows(user.id)).toEqual([
      expect.objectContaining({ actorUserId: admin.id, action: "user:delete", targetType: "User" }),
    ]);
  });
});
