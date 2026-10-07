export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORIES, categoryFromSlug } from "@/lib/documents/subtypes";
import { deleteDocument } from "@/app/[locale]/action";

/**
 * Splits a byte count into the number to display and the unit's message key.
 * The unit is translated rather than hardcoded: French writes o / Ko / Mo.
 */
function splitSize(bytes: number): { value: number; unit: "b" | "kb" | "mb" } {
  if (bytes < 1024) return { value: bytes, unit: "b" };
  if (bytes < 1024 * 1024) return { value: bytes / 1024, unit: "kb" };
  return { value: bytes / (1024 * 1024), unit: "mb" };
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/documents/[category]">) {
  const { category: slug } = await params;

  const category = categoryFromSlug(slug);
  if (category === null) notFound();

  const def = CATEGORIES[category];
  const t = await getTranslations("documentCategory");
  const tCategory = await getTranslations("categories");
  const format = await getFormatter();
  const { user } = await requireUser();

  const documents = await prisma.document.findMany({
    where: { ownerId: user.id, category },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← {t("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{tCategory(`${def.slug}.label`)}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {tCategory(`${def.slug}.description`)}
        </p>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Link
              href="/documents/new"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              {t("addDocument")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const size = splitSize(doc.fileSize);
            return (
            <div
              key={doc.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {doc.fileType.includes("pdf") ? t("fileKind.pdf") : t("fileKind.image")}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/documents/view/${doc.id}`}
                  title={doc.fileName}
                  className="block truncate font-medium hover:underline"
                >
                  {doc.fileName}
                </Link>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {format.number(size.value, { maximumFractionDigits: 1 })}{" "}
                  {t(`size.${size.unit}`)} ·{" "}
                  {format.dateTime(doc.createdAt, { dateStyle: "short" })}
                </p>
              </div>

              {/* Below sm: status and actions wrap onto a second, full-width row. */}
              <div className="flex w-full items-center gap-4 sm:w-auto">
                {doc.extractionStatus === "PENDING" && (
                  <Badge tone="warning" className="text-center">{t("status.pending")}</Badge>
                )}
                {doc.extractionStatus === "NEEDS_REVIEW" && (
                  <Badge tone="warning" className="text-center">{t("status.needsReview")}</Badge>
                )}

                <div className="ml-auto flex items-center gap-4">
                  <a
                    href={`/api/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("view", { fileName: doc.fileName })}
                    className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="size-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  </a>

                  <form action={deleteDocument}>
                    <input type="hidden" name="id" value={doc.id} />
                    <Button variant="secondary" aria-label={t("delete", { fileName: doc.fileName })}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </Button>
                  </form>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
