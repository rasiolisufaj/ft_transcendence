import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <EmptyState
      title={t("title")}
      description={t("description")}
      action={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:border-zinc-700 hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:border-zinc-300 dark:hover:bg-zinc-300"
        >
          {t("backHome")}
        </Link>
      }
    />
  );
}
