import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const link =
  "text-foreground-muted underline-offset-4 transition hover:text-foreground hover:underline";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-xs">
        <span className="text-foreground-subtle">
          &copy; {new Date().getFullYear()} MesPapiers
        </span>
        <nav className="flex gap-4" aria-label={t("nav")}>
          <Link href="/privacy" className={link}>
            {t("privacy")}
          </Link>
          <Link href="/terms" className={link}>
            {t("terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
