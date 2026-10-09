import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";

const primary =
  "inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export default async function MyDataPage() {
  await requireUser();
  const t = await getTranslations("myData");

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("intro")}</p>

        <section className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            {t("exportTitle")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("exportDesc")}</p>
          {/* A plain <a>, not next-intl's Link: /api routes have no locale prefix. */}
          <a href="/api/account/export" className={`${primary} mt-4`}>
            {t("exportButton")}
          </a>
        </section>
      </Card>
    </main>
  );
}