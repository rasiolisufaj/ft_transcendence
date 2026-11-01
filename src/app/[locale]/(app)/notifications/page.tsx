export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/session";
import { notificationViews } from "@/lib/notifications/views";
import { markAllReadAction, openNotificationAction } from "./actions";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  // The (app) layout is not a security boundary.
  const { user } = await requireUser();
  const notifications = await notificationViews(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {notifications.some((notification) => !notification.isRead) ? (
          <form action={markAllReadAction}>
            <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
              {t("markAllRead")}
            </Button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={notification.id} />
                <button
                  type="submit"
                  className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:focus-visible:bg-zinc-800/50"
                >
                  <span className={`min-w-0 text-sm break-words ${notification.isRead ? "" : "font-semibold"}`}>
                    {notification.text}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {notification.isRead ? null : <Badge tone="danger">{t("unreadLabel")}</Badge>}
                    <time
                      dateTime={notification.at}
                      className="text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      {notification.time}
                    </time>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
