import { z } from "zod";
import type { Notification, NotificationType } from "@/generated/prisma/client";
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

async function withNames(rows: Notification[]) {
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

export async function listNotifications(me: string, take = 30) {
  const rows = await prisma.notification.findMany({
    where: { recipientId: me },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
  return withNames(rows);
}

// Scoped to the recipient: someone else's id reads and changes nothing.
export async function openNotification(me: string, id: number): Promise<string> {
  const row = await prisma.notification.findFirst({ where: { id, recipientId: me } });
  if (!row) {
    return "/notifications";
  }
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
  const [notification] = await withNames([row]);
  return notification ? notificationHref(notification) : "/notifications";
}

// content is written by notify(), so the same JSON finds this person's messages.
export async function markMessagesRead(me: string, from: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { recipientId: me, type: "MESSAGE", isRead: false, content: JSON.stringify({ userId: from }) },
    data: { isRead: true },
  });
  return count;
}

export function unreadCount(me: string) {
  return prisma.notification.count({ where: { recipientId: me, isRead: false } });
}

export async function markAllRead(me: string) {
  await prisma.notification.updateMany({ where: { recipientId: me, isRead: false }, data: { isRead: true } });
}

export function notificationHref(notification: {
  type: NotificationType;
  actor: { id: string } | null;
  channel: { id: number } | null;
}): string {
  switch (notification.type) {
    case "FRIEND_REQUEST":
      return "/friends";
    case "REPLY":
      return notification.channel ? `/channels/${notification.channel.id}` : "/channels";
    case "MESSAGE":
      return notification.actor ? `/messages/${notification.actor.id}` : "/notifications";
    default:
      return "/notifications";
  }
}
