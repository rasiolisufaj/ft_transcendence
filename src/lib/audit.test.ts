import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

describe("writeAudit", () => {
  const targetId = randomUUID();
  let userId: string;
  let channelId: number;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test" },
    });
    userId = user.id;
    const channel = await prisma.channel.create({
      data: { createdBy: userId, title: `test-${randomUUID()}` },
    });
    channelId = channel.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // AuditLog.actor et AuditLog.channel sont onDelete: SetNull, donc les lignes
    // survivent a la suppression du user et du channel : on les nettoie d'abord.
    await prisma.auditLog.deleteMany({ where: { targetId } });
    await prisma.channel.delete({ where: { id: channelId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } });
  });

  it("records who did what to which target, in which channel", async () => {
    await writeAudit({
      actorUserId: userId,
      action: "channel:kick",
      targetType: "User",
      targetId,
      channelId,
      metadata: { reason: "spam" },
    });

    const rows = await prisma.auditLog.findMany({ where: { targetId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: userId,
      action: "channel:kick",
      targetType: "User",
      channelId,
      metadata: { reason: "spam" },
    });
  });

  it("never throws: a failed write is logged and the action goes on", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    // No such user: the actor foreign key rejects the insert.
    await expect(
      writeAudit({ actorUserId: "no-such-user", action: "user:manage", targetType: "User", targetId }),
    ).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalled();
    expect(await prisma.auditLog.count({ where: { targetId } })).toBe(0);
  });
});
