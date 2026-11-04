import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeadlineType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DAY_MS } from "@/lib/documents/status";
import { publish } from "@/lib/realtime/publish";
import { scanDeadlines } from "@/worker/scan";

vi.mock("@/lib/realtime/publish", () => ({ publish: vi.fn() }));

// The scan reads every user's documents, so it also notifies the seeded ones, exactly as
// the running worker would. That is why `now` stays real here: a frozen future date
// would leave them wrong notifications.
let owner: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Owner" },
  });
  owner = user.id;
});

afterEach(async () => {
  // Cascades the documents and their notifications.
  await prisma.user.deleteMany({ where: { id: owner } });
  vi.mocked(publish).mockReset();
});

async function createDocument(deadlineType: DeadlineType | null, daysLeft: number | null) {
  const document = await prisma.document.create({
    data: {
      ownerId: owner,
      fileName: "carte.pdf",
      fileType: "application/pdf",
      fileSize: 1,
      fileData: Buffer.from("x"),
      fileHash: randomUUID(),
      deadlineType,
      targetDate: daysLeft === null ? null : new Date(Date.now() + daysLeft * DAY_MS),
    },
  });
  return document.id;
}

const mine = () =>
  prisma.notification.findMany({
    where: { recipientId: owner },
    orderBy: [{ documentId: "asc" }, { id: "asc" }],
    select: { documentId: true, type: true },
  });

describe("scanDeadlines", () => {
  it("tells the owner about an ID that expires soon, and about one that has expired", async () => {
    const soon = await createDocument("HARD", 30);
    const expired = await createDocument("HARD", -10);

    await scanDeadlines();

    expect(await mine()).toEqual([
      { documentId: soon, type: "DEADLINE" },
      { documentId: expired, type: "DEADLINE_PASSED" },
    ]);
  });

  it("leaves alone what is not an expiry, or not yet", async () => {
    await createDocument("HARD", 200);
    await createDocument("SOFT", 30);
    await createDocument("NONE", null);
    await createDocument("HARD", null);

    await scanDeadlines();

    expect(await mine()).toEqual([]);
  });

  it("sends nothing new on a second run, and tells the bell once", async () => {
    await createDocument("HARD", 30);
    // One `now` for both runs, or a seeded ID on the 90-day line could cross it in between.
    const now = new Date();

    await scanDeadlines(now);
    expect(await scanDeadlines(now)).toBe(0);

    const saved = await prisma.notification.findFirstOrThrow({ where: { recipientId: owner } });
    const told = vi
      .mocked(publish)
      .mock.calls.filter(([event]) => event.type === "notification.created" && event.recipientId === owner);
    expect(told).toEqual([
      [{ type: "notification.created", notificationId: saved.id, recipientId: owner, at: saved.createdAt.toISOString() }],
    ]);
  });

  it("tells the owner again once the ID has expired", async () => {
    const id = await createDocument("HARD", 30);
    await scanDeadlines();

    await prisma.document.update({ where: { id }, data: { targetDate: new Date(Date.now() - 10 * DAY_MS) } });
    await scanDeadlines();

    expect(await mine()).toEqual([
      { documentId: id, type: "DEADLINE" },
      { documentId: id, type: "DEADLINE_PASSED" },
    ]);
  });

  it("drops the notification with its document", async () => {
    const id = await createDocument("HARD", 30);
    await scanDeadlines();

    await prisma.document.delete({ where: { id } });

    expect(await mine()).toEqual([]);
  });
});
