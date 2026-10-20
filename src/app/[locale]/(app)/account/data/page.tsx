import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { DeleteAccountForm } from "./DeleteAccountForm";

const primary =
  "inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export default async function MyDataPage() {
  await requireUser();
  const t = await getTranslations("myData");
  const locale = await getLocale();

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
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
          <form method="post" action="/api/account/export" className="mt-4">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={primary}>
              {t("exportButton")}
            </button>
          </form>
        </section>

        <section className="mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-red-600 dark:text-red-400">
            {t("deleteTitle")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("deleteDesc")}</p>
          <DeleteAccountForm />
        </section>
      </Card>
    </section>
  );
}