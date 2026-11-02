import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications/notifications";
import { notificationViews } from "@/lib/notifications/views";

vi.mock("@/lib/realtime/publish", () => ({ publish: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, values?: object) => `${key}${values ? JSON.stringify(values) : ""}`),
  getFormatter: vi.fn(async () => ({ dateTime: () => "formatted" })),
}));

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
  channelId = (await prisma.channel.create({ data: { title: "Impots" } })).id;
});

afterEach(async () => {
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
});

describe("notificationViews", () => {
  it("gives the text and the state of a friend request", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });

    const [view] = await notificationViews(alice);

    expect(view).toMatchObject({
      text: 'friendRequest{"name":"Bob"}',
      isRead: false,
      time: "formatted",
    });
  });

  it("names the channel of a reply", async () => {
    await notify(alice, "REPLY", { userId: bob, channelId });

    const [view] = await notificationViews(alice);

    expect(view?.text).toBe('reply{"name":"Bob","channel":"Impots"}');
  });

  it("falls back when the person is gone", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    await prisma.user.delete({ where: { id: bob } });

    const [view] = await notificationViews(alice);

    expect(view?.text).toBe('friendRequest{"name":"deletedUser"}');
  });

  it("keeps only the newest ones when asked", async () => {
    await notify(alice, "FRIEND_REQUEST", { userId: bob });
    await notify(alice, "REPLY", { userId: bob, channelId });

    expect(await notificationViews(alice, 1)).toHaveLength(1);
  });
});
