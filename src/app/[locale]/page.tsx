export const dynamic = "force-dynamic";

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const uploadLinkClasses =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  const documents = await prisma.document.findMany({
    select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
        <Link href="/documents/new" className={uploadLinkClasses}>
          {t("upload")}
        </Link>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link href="/documents/new" className={uploadLinkClasses}>
              {t("upload")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {doc.fileType.includes("pdf") ? "PDF" : "IMG"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.fileName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatSize(doc.fileSize)} · {doc.createdAt.toLocaleDateString(locale)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
