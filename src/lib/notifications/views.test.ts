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

async function deadlineFor(recipientId: string, type: "DEADLINE" | "DEADLINE_PASSED") {
  const document = await prisma.document.create({
    data: {
      ownerId: recipientId,
      fileName: "carte.pdf",
      fileType: "application/pdf",
      fileSize: 1,
      fileData: Buffer.from("x"),
      fileHash: randomUUID(),
      deadlineType: "HARD",
      targetDate: new Date("2027-03-15T00:00:00Z"),
    },
  });
  await prisma.notification.create({ data: { recipientId, type, documentId: document.id, content: "{}" } });
}

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

  it("names the document that expires soon, with its date", async () => {
    await deadlineFor(alice, "DEADLINE");

    const [view] = await notificationViews(alice);

    expect(view?.text).toBe('deadline{"name":"carte.pdf","date":"formatted"}');
  });

  it("names the document that has expired", async () => {
    await deadlineFor(alice, "DEADLINE_PASSED");

    const [view] = await notificationViews(alice);

    expect(view?.text).toBe('deadlinePassed{"name":"carte.pdf","date":"formatted"}');
  });
});
