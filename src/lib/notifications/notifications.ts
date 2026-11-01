import { z } from "zod";
import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/realtime/publish";

// content holds ids, not text: the reader's locale renders it, and a rename shows everywhere.
const dataSchema = z.object({ userId: z.string(), channelId: z.number().int().optional() });
export type NotificationData = z.infer<typeof dataSchema>;

function parse(content: string): NotificationData | null {
  try {
    const result = dataSchema.safeParse(JSON.parse(content));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function notify(recipientId: string, type: NotificationType, data: NotificationData) {
  if (data.userId === recipientId) {
    return;
  }
  try {
    const notification = await prisma.notification.create({
      data: { recipientId, type, content: JSON.stringify(data) },
    });
    await publish({
      type: "notification.created",
      notificationId: notification.id,
      recipientId,
      at: notification.createdAt.toISOString(),
    });
  } catch (error) {
    // The action that called this has already succeeded.
    console.error("notification failed", type, error);
  }
}

export async function listNotifications(me: string, take = 30) {
  const rows = await prisma.notification.findMany({
    where: { recipientId: me },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
  const data = rows.map((row) => parse(row.content));
  const userIds = [...new Set(data.flatMap((d) => (d ? [d.userId] : [])))];
  const channelIds = [...new Set(data.flatMap((d) => (d?.channelId ? [d.channelId] : [])))];
  const [users, channels] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } }),
    prisma.channel.findMany({ where: { id: { in: channelIds } }, select: { id: true, title: true } }),
  ]);
  return rows.map((row, i) => ({
    id: row.id,
    type: row.type,
    isRead: row.isRead,
    createdAt: row.createdAt,
    actor: users.find((user) => user.id === data[i]?.userId) ?? null,
    channel: channels.find((channel) => channel.id === data[i]?.channelId) ?? null,
  }));
}

export function unreadCount(me: string) {
  return prisma.notification.count({ where: { recipientId: me, isRead: false } });
}

export async function markAllRead(me: string) {
  await prisma.notification.updateMany({ where: { recipientId: me, isRead: false }, data: { isRead: true } });
}
