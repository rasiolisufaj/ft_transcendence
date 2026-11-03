export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashboardDecor } from "@/components/dashboard/DashboardDecor";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/session";
import { notificationViews } from "@/lib/notifications/views";
import { markAllReadAction, openNotificationAction } from "./actions";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  // The (app) layout is not a security boundary.
  const { user } = await requireUser();
  const notifications = await notificationViews(user.id);

  return (
    <div className="relative">
      <DashboardDecor />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
          {notifications.some((notification) => !notification.isRead) ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                {t("markAllRead")}
              </Button>
            </form>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={notification.id} />
                  <button
                    type="submit"
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left transition hover:bg-surface-hover focus-visible:bg-surface-hover"
                  >
                    <span className={`min-w-0 text-sm break-words ${notification.isRead ? "" : "font-semibold"}`}>
                      {notification.text}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {notification.isRead ? null : <Badge tone="danger">{t("unreadLabel")}</Badge>}
                      <time dateTime={notification.at} className="text-xs text-foreground-subtle">
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
    </div>
  );
}
