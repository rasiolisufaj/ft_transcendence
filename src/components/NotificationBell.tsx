"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { markAllReadAction, openNotificationAction } from "@/app/[locale]/(app)/notifications/actions";
import { Link, useRouter } from "@/i18n/navigation";
import type { NotificationView } from "@/lib/notifications/views";
import { isNewNotification } from "@/lib/realtime/client";
import { useRealtimeMessage } from "./RealtimeProvider";

const action =
  "block w-full px-3 py-3 md:py-2 text-left text-sm text-foreground-muted transition hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none";

// A disclosure like UserMenu. Below md the panel hangs from the header, not the bell: the bell is not at the bar's edge, so it would overflow.
export function NotificationBell({ count, notifications }: { count: number; notifications: NotificationView[] }) {
  const tNav = useTranslations("nav");
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useRealtimeMessage((message) => {
    if (isNewNotification(message)) {
      router.refresh();
    }
  });

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="md:relative"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={tNav("notifications", { count })}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="relative block rounded-lg p-1 text-foreground-muted transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-primary-foreground"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-4 top-full z-10 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated md:inset-x-auto md:end-0 md:w-80"
      >
        <p className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">{t("title")}</p>

        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-foreground-muted">{t("nothingNew")}</p>
        ) : (
          <>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <form action={openNotificationAction} onSubmit={() => setOpen(false)}>
                    <input type="hidden" name="id" value={notification.id} />
                    <button
                      type="submit"
                      className="block w-full px-3 py-2 text-left transition hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                    >
                      <span className={`block text-sm break-words ${notification.isRead ? "" : "font-semibold"}`}>
                        {notification.text}
                      </span>
                      <time dateTime={notification.at} className="text-xs text-foreground-subtle">
                        {notification.time}
                      </time>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <div className="border-t border-border">
              {count > 0 ? (
                <form action={markAllReadAction}>
                  <button type="submit" className={action}>
                    {t("markAllRead")}
                  </button>
                </form>
              ) : null}
              <Link href="/notifications" onClick={() => setOpen(false)} className={action}>
                {t("seeAll")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
