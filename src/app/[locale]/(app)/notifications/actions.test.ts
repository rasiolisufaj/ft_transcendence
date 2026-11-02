import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "@/i18n/navigation";
import { notify, unreadCount } from "@/lib/notifications/notifications";
import { markAllReadAction, openNotificationAction } from "./actions";

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "fr") }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/realtime/publish", () => ({ publish: vi.fn() }));

let alice: string;
let bob: string;

async function createUser(name: string) {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: name },
  });
  return user.id;
}

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  const { token } = await createSession(alice);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
});

describe("markAllReadAction", () => {
  it("clears the signed-in user's notifications only", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    await notify(bob, "FRIEND_REQUEST", { userId: alice });

    await markAllReadAction();

    expect(await unreadCount(alice)).toBe(0);
    expect(await unreadCount(bob)).toBe(1);
  });
});

describe("openNotificationAction", () => {
  const form = (id: string) => {
    const f = new FormData();
    f.set("id", id);
    return f;
  };

  it("marks it as read, then goes to its page", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    const { id } = await prisma.notification.findFirstOrThrow({ where: { recipientId: alice } });

    await openNotificationAction(form(String(id)));

    expect(await unreadCount(alice)).toBe(0);
    expect(redirect).toHaveBeenCalledWith({ href: "/friends", locale: "fr" });
  });

  it.each(["abc", "-1", "99999999999"])("goes to the list on a bad id: %s", async (id) => {
    await openNotificationAction(form(id));

    expect(redirect).toHaveBeenLastCalledWith({ href: "/notifications", locale: "fr" });
  });
});
