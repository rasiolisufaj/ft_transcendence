"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { logout } from "@/app/[locale]/(auth)/logout/actions";
import { Link, usePathname } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/Avatar";

// Same rows as LocaleSwitcher: a ✓ column, then the label. 44 px tall below md, where
// only the ☰ panel shows them (touch); 36 px in the desktop dropdown.
const item =
  "flex w-full items-center gap-2 px-3 py-3 md:py-2 text-left text-sm transition hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none";
const idle = "text-foreground-muted";
const current = "font-medium text-foreground";

// The account menu of the desktop bar, built like LocaleSwitcher (disclosure, not role="menu").
export function UserMenu({ name, userId, isAdmin }: { name: string; userId: string; isAdmin: boolean }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

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
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-border py-1 pe-3 ps-1 text-sm font-medium text-foreground transition hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="sr-only">{t("account")}</span>
        <Avatar name={name} size="sm" />
        <span className="max-w-28 truncate">{name}</span>
        <ChevronIcon className={open ? "rotate-180" : undefined} />
      </button>

      <ul
        id={listId}
        hidden={!open}
        className="absolute end-0 top-full z-10 mt-2 min-w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-elevated"
      >
        {/* compact: the ☰ panel below already lists Dashboard/Channels/Friends, and the
            desktop bar shows them next to this menu (NavLinks) — no need for them twice. */}
        <AccountLinks userId={userId} isAdmin={isAdmin} onNavigate={() => setOpen(false)} compact />
      </ul>
    </div>
  );
}

// The account rows (<li>s), shared by this dropdown and the ☰ panel.
export function AccountLinks({
  userId,
  isAdmin,
  onNavigate,
  compact = false,
}: {
  userId: string;
  isAdmin: boolean;
  onNavigate?: () => void;
  /** Leaves out Dashboard/Channels/Friends: NavLinks already shows them next to this menu. */
  compact?: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <>
      {[
        ...(compact
          ? []
          : [
              { href: "/", label: t("dashboard") },
              { href: "/channels", label: t("channels") },
              { href: "/friends", label: t("friends") },
            ]),
        { href: `/users/${userId}`, label: t("profile") },
        { href: "/account/data", label: t("myData") },
        ...(isAdmin ? [{ href: "/admin/users", label: t("admin") }] : []),
      ].map((page) => {
        const active = pathname === page.href;
        return (
          <li key={page.href}>
            <Link
              href={page.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`${item} ${active ? current : idle}`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
              />
              {page.label}
            </Link>
          </li>
        );
      })}
      {/* The separator is a border, not an empty <li>: a list may only hold list items. */}
      <li className="mt-1 border-t border-border pt-1">
        <form action={logout}>
          <button type="submit" className={`${item} ${idle}`}>
            <span aria-hidden="true" className="size-1.5 shrink-0" />
            {t("logout")}
          </button>
        </form>
      </li>
    </>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-3 transition-transform ${className ?? ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
