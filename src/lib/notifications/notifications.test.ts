import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  listNotifications,
  markAllRead,
  notificationHref,
  notify,
  openNotification,
  unreadCount,
} from "@/lib/notifications/notifications";
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

describe("notificationHref", () => {
  const actor = { id: "bob", displayName: "Bob" };
  const channel = { id: 3, title: "Impots" };

  it("sends a friend request to the friends page", () => {
    expect(notificationHref({ type: "FRIEND_REQUEST", actor, channel: null })).toBe("/friends");
  });

  it("sends a reply to its channel", () => {
    expect(notificationHref({ type: "REPLY", actor, channel })).toBe("/channels/3");
  });

  it("sends a reply whose channel is gone to the channel list", () => {
    expect(notificationHref({ type: "REPLY", actor, channel: null })).toBe("/channels");
  });

  it("sends a message to the conversation", () => {
    expect(notificationHref({ type: "MESSAGE", actor, channel: null })).toBe("/messages/bob");
  });

  it("stays on the list when there is nowhere to go", () => {
    expect(notificationHref({ type: "MESSAGE", actor: null, channel: null })).toBe("/notifications");
    expect(notificationHref({ type: "OTHER", actor, channel: null })).toBe("/notifications");
  });
});

describe("openNotification", () => {
  const idOf = async (recipientId: string) =>
    (await prisma.notification.findFirstOrThrow({ where: { recipientId } })).id;

  it("marks that one as read, leaves the others, and gives its link", async () => {
    await notify(alice, "REPLY", { userId: bob, channelId });
    const replyId = await idOf(alice);
    await notify(alice, "FRIEND_REQUEST", { userId: bob });

    expect(await openNotification(alice, replyId)).toBe(`/channels/${channelId}`);

    expect((await prisma.notification.findUniqueOrThrow({ where: { id: replyId } })).isRead).toBe(true);
    expect(await unreadCount(alice)).toBe(1);
  });

  it("does not touch someone else's notification", async () => {
    await notify(bob, "FRIEND_REQUEST", { userId: alice });
    const theirs = await idOf(bob);

    expect(await openNotification(alice, theirs)).toBe("/notifications");

    expect(await unreadCount(bob)).toBe(1);
  });

  it("sends a reply whose channel is gone to the channel list", async () => {
    await notify(alice, "REPLY", { userId: bob, channelId: 999_999_999 });

    expect(await openNotification(alice, await idOf(alice))).toBe("/channels");
  });
});
