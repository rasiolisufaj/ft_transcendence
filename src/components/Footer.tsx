import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const link =
  "text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200";

export async function Footer() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-xs">
        <span className="text-zinc-400 dark:text-zinc-500">
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
