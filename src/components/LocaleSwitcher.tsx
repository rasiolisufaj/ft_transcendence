"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Disclosure pattern (button + list of links), not role="menu": Tab moves through
// the options and each one stays a real link that keeps the current page.
export function LocaleSwitcher() {
  const t = useTranslations("localeSwitcher");
  const current = useLocale();
  const pathname = usePathname();
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
      // Close when keyboard focus leaves the whole switcher.
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
        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium uppercase text-foreground-muted transition hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="sr-only">{t("label")}</span>
        <span lang={current}>{current}</span>
        <ChevronIcon className={open ? "rotate-180" : undefined} />
      </button>

      <ul
        id={listId}
        hidden={!open}
        className="absolute end-0 top-full z-10 mt-2 min-w-40 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-elevated"
      >
        {routing.locales.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none ${
                  active ? "font-medium text-foreground" : "text-foreground-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
                />
                {t(`names.${locale}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
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
