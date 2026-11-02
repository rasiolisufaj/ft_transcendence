"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const base = "border-b-2 pb-1 transition";
const idle = "border-transparent text-foreground-muted hover:border-border-strong hover:text-foreground";
const active = "border-primary font-medium text-foreground";

// The main sections, always visible in the desktop bar (from 768 px) for a
// signed-in user — kept apart from UserMenu, which only holds account rows.
export function NavLinks() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const pages = [
    { href: "/", label: t("dashboard") },
    { href: "/channels", label: t("channels") },
    { href: "/friends", label: t("friends") },
  ];

  return (
    <>
      {pages.map((page) => {
        const isActive = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={isActive ? "page" : undefined}
            className={`${base} ${isActive ? active : idle}`}
          >
            {page.label}
          </Link>
        );
      })}
    </>
  );
}
