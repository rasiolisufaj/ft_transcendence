import { prisma } from "@/lib/db";
import { DAY_MS, EXPIRING_SOON_DAYS, expiryStatus } from "@/lib/documents/status";
import { publish } from "@/lib/realtime/publish";

const TYPE = { EXPIRING_SOON: "DEADLINE", EXPIRED: "DEADLINE_PASSED" } as const;

/**
 * Tells the owner of each HARD document that it expires soon, then that it has expired:
 * one notification per (document, type). @@unique([documentId, type]) makes every later
 * run, or a run at the same time, insert nothing. Returns how many it created.
 */
export async function scanDeadlines(now: Date = new Date()): Promise<number> {
  const documents = await prisma.document.findMany({
    where: {
      deadlineType: "HARD",
      targetDate: { lte: new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS) },
    },
    select: { id: true, ownerId: true, targetDate: true },
  });

  // targetDate <= cutoff already excludes documents with no date (null never satisfies
  // lte), so targetDate below is never null.
  const data = documents.flatMap((document) => {
    const status = expiryStatus(document.targetDate!, now);
    if (status === "VALID") {
      return [];
    }
    return [{ recipientId: document.ownerId, documentId: document.id, type: TYPE[status], content: "{}" }];
  });
  if (data.length === 0) {
    return 0;
  }

  const created = await prisma.notification.createManyAndReturn({ data, skipDuplicates: true });
  for (const notification of created) {
    await publish({
      type: "notification.created",
      notificationId: notification.id,
      recipientId: notification.recipientId,
      at: notification.createdAt.toISOString(),
    });
  }
  return created.length;
}
