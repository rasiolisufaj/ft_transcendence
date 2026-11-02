import { getFormatter, getTranslations } from "next-intl/server";
import { listNotifications } from "./notifications";

// Translated on the server, in the reader's locale, for the bell's panel and the page.
export async function notificationViews(me: string, take?: number) {
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const notifications = await listNotifications(me, take);

  return notifications.map((notification) => {
    const name = notification.actor?.displayName ?? t("deletedUser");
    let text: string;
    switch (notification.type) {
      case "FRIEND_REQUEST":
        text = t("friendRequest", { name });
        break;
      case "REPLY":
        text = t("reply", { name, channel: notification.channel?.title ?? t("deletedChannel") });
        break;
      case "MESSAGE":
        text = t("message", { name });
        break;
      default:
        text = t("other");
    }
    return {
      id: notification.id,
      text,
      isRead: notification.isRead,
      at: notification.createdAt.toISOString(),
      time: format.dateTime(notification.createdAt, { dateStyle: "short", timeStyle: "short" }),
    };
  });
}

export type NotificationView = Awaited<ReturnType<typeof notificationViews>>[number];
