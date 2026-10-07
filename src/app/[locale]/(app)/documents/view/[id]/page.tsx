export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CATEGORIES, type CategoryKey } from "@/lib/documents/subtypes";
import { Link } from "@/i18n/navigation";
import { Chat } from "@/components/assistant/Chat";

function splitSize(bytes: number): { value: number; unit: "b" | "kb" | "mb" } {
  if (bytes < 1024) return { value: bytes, unit: "b" };
  if (bytes < 1024 * 1024) return { value: bytes / 1024, unit: "kb" };
  return { value: bytes / (1024 * 1024), unit: "mb" };
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id: rawId } = await params;
  const t = await getTranslations();
  const format = await getFormatter();

  const id = parseInt(rawId, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== rawId) notFound();

  const { user } = await requireUser();

  const doc = await prisma.document.findFirst({
    where: { id, ownerId: user.id },
    include: { identity: true, insuranceAuto: true },
  });
  if (!doc) notFound();

  const categoryDef = CATEGORIES[doc.category as CategoryKey];
  const slug = categoryDef?.slug ?? "other";

  const statusTone = {
    PENDING: "warning" as const,
    NEEDS_REVIEW: "warning" as const,
    CONFIRMED: "success" as const,
    FAILED: "danger" as const,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
          {t("nav.dashboard")}
        </Link>
        <span>/</span>
        <Link
          href={`/documents/${slug}`}
          className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          {t(`categories.${slug}.label`)}
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{doc.fileName}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left: document info + preview */}
        <div className="space-y-4">
          <Card>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-lg font-semibold">{doc.fileName}</h1>
                <Badge tone={statusTone[doc.extractionStatus]}>
                  {doc.extractionStatus === "CONFIRMED"
                    ? t("documentCategory.status.confirmed")
                    : doc.extractionStatus === "FAILED"
                      ? t("documentCategory.status.failed")
                      : doc.extractionStatus === "NEEDS_REVIEW"
                        ? t("documentCategory.status.needsReview")
                        : t("documentCategory.status.pending")}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.category")}</dt>
                <dd>{t(`categories.${slug}.label`)}</dd>

                <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.size")}</dt>
                <dd>
                  {(() => {
                    const size = splitSize(doc.fileSize);
                    return `${format.number(size.value, { maximumFractionDigits: 1 })} ${t(`documentCategory.size.${size.unit}`)}`;
                  })()}
                </dd>

                <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.type")}</dt>
                <dd>{doc.fileType === "application/pdf" ? "PDF" : "Image"}</dd>

                {doc.deadlineType ? (
                  <>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.deadline")}</dt>
                    <dd>{doc.deadlineType}</dd>
                  </>
                ) : null}

                {doc.targetDate ? (
                  <>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.expiry")}</dt>
                    <dd>{format.dateTime(doc.targetDate, { dateStyle: "short" })}</dd>
                  </>
                ) : null}
              </dl>

              {doc.identity ? (
                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <h2 className="mb-2 text-sm font-medium">{t("documentDetail.extractedFields")}</h2>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.fullName")}</dt>
                    <dd>{doc.identity.fullName}</dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.documentNumber")}</dt>
                    <dd>{doc.identity.documentNumber}</dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.birthDate")}</dt>
                    <dd>{format.dateTime(doc.identity.birthDate, { dateStyle: "short" })}</dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.expiryDate")}</dt>
                    <dd>{format.dateTime(doc.identity.expiryDate, { dateStyle: "short" })}</dd>
                  </dl>
                </div>
              ) : null}

              {doc.insuranceAuto ? (
                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <h2 className="mb-2 text-sm font-medium">{t("documentDetail.extractedFields")}</h2>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.provider")}</dt>
                    <dd>{doc.insuranceAuto.provider}</dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.policyNumber")}</dt>
                    <dd>{doc.insuranceAuto.policyNumber}</dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.vehiclePlate")}</dt>
                    <dd>{doc.insuranceAuto.vehiclePlate}</dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t("documentDetail.fields.expiryDate")}</dt>
                    <dd>{format.dateTime(doc.insuranceAuto.expiryDate, { dateStyle: "short" })}</dd>
                  </dl>
                </div>
              ) : null}
            </div>
          </Card>

          {/* Document preview */}
          <Card>
            <div className="p-4">
              {doc.fileType === "application/pdf" ? (
                <iframe
                  src={`/api/documents/${doc.id}`}
                  title={doc.fileName}
                  className="h-[500px] w-full rounded border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- user-uploaded binary served from API, no static dimensions */
                <img
                  src={`/api/documents/${doc.id}`}
                  alt={doc.fileName}
                  className="max-h-[500px] w-full rounded object-contain"
                />
              )}
            </div>
          </Card>
        </div>

        {/* Right: AI chat */}
        <Card>
          <div className="flex h-[calc(500px+16rem)] flex-col">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold">{t("assistant.title")}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("assistant.subtitle")}</p>
            </div>
            <Chat documentId={doc.id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
