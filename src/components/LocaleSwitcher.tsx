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
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium uppercase text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
      >
        <LanguageIcon />
        <span className="sr-only">{t("label")}</span>
        <span lang={current}>{current}</span>
        <ChevronIcon className={open ? "rotate-180" : undefined} />
      </button>

      <ul
        id={listId}
        hidden={!open}
        className="absolute end-0 top-full z-10 mt-2 min-w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
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
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 ${
                  active
                    ? "font-semibold text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <span aria-hidden="true" className="w-4 text-center">
                  {active ? "✓" : ""}
                </span>
                {t(`names.${locale}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LanguageIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
      />
    </svg>
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
