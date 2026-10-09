"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { logout } from "@/app/[locale]/(auth)/logout/actions";
import { Link, usePathname } from "@/i18n/navigation";

// Same rows as LocaleSwitcher: a ✓ column, then the label. 44 px tall below md, where
// only the ☰ panel shows them (touch); 36 px in the desktop dropdown.
const item =
  "flex w-full items-center gap-2 px-3 py-3 md:py-2 text-left text-sm hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800";
const idle = "text-zinc-600 dark:text-zinc-400";
const current = "font-semibold text-zinc-900 dark:text-zinc-100";

// The account menu of the desktop bar, built like LocaleSwitcher (disclosure, not role="menu").
export function UserMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
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
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
      >
        <span className="sr-only">{t("account")}</span>
        <span className="max-w-32 truncate">{name}</span>
        <ChevronIcon className={open ? "rotate-180" : undefined} />
      </button>

      <ul
        id={listId}
        hidden={!open}
        className="absolute end-0 top-full z-10 mt-2 min-w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <AccountLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
      </ul>
    </div>
  );
}

// The account rows (<li>s), shared by this dropdown and the ☰ panel.
export function AccountLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <>
      {[
        { href: "/", label: t("dashboard") },
        { href: "/friends", label: t("friends") },
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
              <span aria-hidden="true" className="w-4 text-center">
                {active ? "✓" : ""}
              </span>
              {page.label}
            </Link>
          </li>
        );
      })}
      {/* The separator is a border, not an empty <li>: a list may only hold list items. */}
      <li className="mt-1 border-t border-zinc-200 pt-1 dark:border-zinc-800">
        <form action={logout}>
          <button type="submit" className={`${item} ${idle}`}>
            <span aria-hidden="true" className="w-4" />
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
