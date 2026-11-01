import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { listNotifications, markAllRead, notify, unreadCount } from "@/lib/notifications/notifications";
import { publish } from "@/lib/realtime/publish";

vi.mock("@/lib/realtime/publish", () => ({ publish: vi.fn() }));

let alice: string;
let bob: string;
let channelId: number;

async function createUser(name: string) {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: name },
  });
  return user.id;
}

beforeEach(async () => {
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  channelId = (await prisma.channel.create({ data: { title: `test-${randomUUID()}` } })).id;
});

afterEach(async () => {
  await prisma.channel.deleteMany({ where: { id: channelId } });
  // Cascades the notifications.
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
  vi.mocked(publish).mockReset();
});

const later = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("notify", () => {
  it("saves the notification, then tells the recipient's bell", async () => {
    let savedFirst = false;
    vi.mocked(publish).mockImplementation(async () => {
      savedFirst = (await prisma.notification.count({ where: { recipientId: alice } })) === 1;
    });

    await notify(alice, "FRIEND_REQUEST", { userId: bob });

    const saved = await prisma.notification.findFirstOrThrow({ where: { recipientId: alice } });
    expect(saved.type).toBe("FRIEND_REQUEST");
    expect(publish).toHaveBeenCalledWith({
      type: "notification.created",
      notificationId: saved.id,
      recipientId: alice,
      at: saved.createdAt.toISOString(),
    });
    expect(savedFirst).toBe(true);
  });

  it("does not notify you about your own action", async () => {
    await notify(alice, "REPLY", { userId: alice, channelId });

    expect(await prisma.notification.count({ where: { recipientId: alice } })).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("notify, when it fails", () => {
  it("logs instead of breaking the action that called it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notify("no-such-user", "FRIEND_REQUEST", { userId: bob })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("listNotifications", () => {
  it("lists mine newest first, with the person and the channel", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    await later();
    await notify(alice, "REPLY", { userId: bob, channelId });

    const list = await listNotifications(alice);

    expect(list.map((n) => n.type)).toEqual(["REPLY", "FRIEND_REQUEST"]);
    expect(list[0]?.actor).toEqual({ id: bob, displayName: "Bob" });
    expect(list[0]?.channel?.id).toBe(channelId);
    expect(list[1]?.channel).toBeNull();
  });

  it("keeps a notification whose person was deleted", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    await prisma.user.delete({ where: { id: bob } });

    const [only] = await listNotifications(alice);

    expect(only?.actor).toBeNull();
  });

  it("does not show someone else's notifications", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });

    expect(await listNotifications(bob)).toEqual([]);
  });
});

describe("unread", () => {
  it("counts my unread notifications, and markAllRead clears them", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    await notify(alice, "REPLY", { userId: bob, channelId });
    await notify(bob, "FRIEND_REQUEST", { userId: alice });
    expect(await unreadCount(alice)).toBe(2);

    await markAllRead(alice);

    expect(await unreadCount(alice)).toBe(0);
    expect(await unreadCount(bob)).toBe(1);
  });
});
