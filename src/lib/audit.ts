import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * C6: every privileged mutation writes one row. Fire-and-forget by design —
 * a failed audit write must never roll back the action the user asked for.
 * AuditLog.channelId is String? while Channel.id is Int, so it is stringified (§C-8).
 */
export async function writeAudit(entry: {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  channelId?: number | null;
  metadata?: Prisma.InputJsonObject;   // JSON-safe values only, checked at compile time
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        channelId: entry.channelId == null ? null : String(entry.channelId),
        metadata: entry.metadata,
      },
    });
  } catch (error) {
    console.error("audit write failed", entry.action, error);
  }
}
