import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSession,
  requireUser,
  validateSessionToken,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { deleteAccount, type DeleteAccountState } from "./actions";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
  clearSessionCookie: vi.fn(),
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/navigation")>()),
  redirect: vi.fn(),
}));
// next-intl/server needs a request scope; the page's locale is "en" here, and the
// stub returns which locale and key were asked for.
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) => `${locale}.${namespace}.${key}`,
}));

const PASSWORD = "correct-password";

function form(password: string): FormData {
  const f = new FormData();
  f.set("password", password);
  return f;
}

const created: string[] = [];

async function newUser(globalRole: "USER" | "ADMIN") {
  const user = await prisma.user.create({
    data: {
      email: `test-${randomUUID()}@mespapiers.test`,
      displayName: "Test",
      globalRole,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  created.push(user.id);
  return user;
}

async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

const auditRows = (targetId: string) => prisma.auditLog.findMany({ where: { targetId } });

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.auditLog.deleteMany({ where: { targetId: { in: created } } });
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  created.length = 0;
});

describe("deleteAccount", () => {
  let user: { id: string; email: string };

  beforeEach(async () => {
    user = await newUser("USER");
  });

  it("refuses a wrong password and changes nothing", async () => {
    await signInAs(user.id);

    await expect(deleteAccount({}, form("wrong"))).resolves.toEqual({ error: "wrongPassword" });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await auditRows(user.id)).toEqual([]);
  });

  it("locks after 6 failed attempts", async () => {
    await signInAs(user.id);

    for (let i = 0; i < 6; i++) {
      await expect(deleteAccount({}, form("wrong"))).resolves.toEqual({ error: "wrongPassword" });
    }
    await expect(deleteAccount({}, form(PASSWORD))).resolves.toEqual({ error: "tooManyAttempts" });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("deletes the account, audits it, mails in the page's locale and clears the cookie", async () => {
    await signInAs(user.id);

    await deleteAccount({}, form(PASSWORD));

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await auditRows(user.id)).toEqual([
      expect.objectContaining({ actorUserId: null, action: "gdpr:delete", targetType: "User" }),
    ]);
    expect(sendMail).toHaveBeenCalledExactlyOnceWith(
      user.email,
      "en.myData.deleteMailSubject",
      "en.myData.deleteMailBody",
    );
    expect(clearSessionCookie).toHaveBeenCalledOnce();
  });

  it("mails and audits once when the same account is deleted twice at once", async () => {
    await signInAs(user.id);

    await Promise.all([deleteAccount({}, form(PASSWORD)), deleteAccount({}, form(PASSWORD))]);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await auditRows(user.id)).toHaveLength(1);
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("lets an account with no password (Google sign-in) confirm with its email instead", async () => {
    const google = await prisma.user.create({
      data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Google" },
    });
    created.push(google.id);
    await signInAs(google.id);
    const typed = (email: string) => {
      const f = new FormData();
      f.set("email", email);
      return f;
    };

    await expect(deleteAccount({}, typed("someone-else@mespapiers.test"))).resolves.toEqual({
      error: "wrongEmail",
    });
    expect(await prisma.user.findUnique({ where: { id: google.id } })).not.toBeNull();

    await deleteAccount({}, typed(` ${google.email.toUpperCase()} `));
    expect(await prisma.user.findUnique({ where: { id: google.id } })).toBeNull();
  });
});

describe("deleteAccount, the last-admin guard", () => {
  let seededAdmins: string[] = [];

  // The seed's admin (rasiol@gmail.com) would count as "another admin":
  // set the existing admins aside for each test, and put them back after.
  beforeEach(async () => {
    const admins = await prisma.user.findMany({ where: { globalRole: "ADMIN" }, select: { id: true } });
    seededAdmins = admins.map((a) => a.id);
    await prisma.user.updateMany({ where: { id: { in: seededAdmins } }, data: { globalRole: "USER" } });
  });

  afterEach(async () => {
    await prisma.user.updateMany({ where: { id: { in: seededAdmins } }, data: { globalRole: "ADMIN" } });
  });

  it("refuses the last admin", async () => {
    const admin = await newUser("ADMIN");
    await signInAs(admin.id);

    await expect(deleteAccount({}, form(PASSWORD))).resolves.toEqual({ error: "lastAdmin" });
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
  });

  it("does not refuse an admin when another admin exists", async () => {
    const admin = await newUser("ADMIN");
    await newUser("ADMIN");
    await signInAs(admin.id);

    await deleteAccount({}, form(PASSWORD));

    expect(await prisma.user.findUnique({ where: { id: admin.id } })).toBeNull();
  });

  it("refuses an admin while the only other admin's deletion is in flight", async () => {
    const a = await newUser("ADMIN");
    const b = await newUser("ADMIN");
    await signInAs(a.id);

    let pending!: Promise<DeleteAccountState>;
    // b's deletion stays open, not committed, while a deletes itself. a must wait
    // for it, then see it is the last admin; reading b as still there is the race.
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: b.id } });
      pending = deleteAccount({}, form(PASSWORD));
      await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, 1000))]);
    });

    await expect(pending).resolves.toEqual({ error: "lastAdmin" });
    expect(await prisma.user.findUnique({ where: { id: a.id } })).not.toBeNull();
  });
});
