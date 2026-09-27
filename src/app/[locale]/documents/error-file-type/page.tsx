import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { enableStaticRendering } from "@/i18n/static";

export default async function DocumentFileType({
  params,
}: PageProps<"/[locale]/documents/error-file-type">) {
  const { locale } = await params;
  enableStaticRendering(locale);
  const t = await getTranslations("documentErrors");

  return (
    <div className="mx-auto max-w-xl pt-12">
      <Card className="border border-red-500/40 bg-red-500/5">
        <h1 className="mb-2 text-2xl font-semibold text-red-500">
          {t("fileType.title")}
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          {t("fileType.description")}
        </p>

        <div className="space-y-3">
          <Link
            href="/documents/new"
            className="block w-full rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-red-700"
          >
            {t("chooseAnother")}
          </Link>
          <Link
            href="/"
            className="block w-full rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm hover:bg-zinc-800"
          >
            {t("backToDocuments")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
