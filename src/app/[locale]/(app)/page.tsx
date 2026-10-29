export const dynamic = "force-dynamic";

import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { HowItWorksDialog } from "@/components/dashboard/HowItWorksDialog";
import { UploadDropzone } from "@/components/dashboard/UploadDropzone";
import { AssistantSection } from "@/components/dashboard/AssistantSection";
import { DashboardDecor } from "@/components/dashboard/DashboardDecor";
import { CATEGORIES, categoryCards, type CategoryCard, type CategoryKey } from "@/lib/documents/subtypes";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tCategory = await getTranslations("categories");
  const format = await getFormatter();
  const { user } = await requireUser();

  const grouped = await prisma.document.groupBy({
    by: ["category"],
    where: { ownerId: user.id },
    _count: { _all: true },
  });

  const countByCategory = new Map<CategoryKey, number>(
    grouped.map((row) => [row.category as CategoryKey, row._count._all]),
  );
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  const pending = await prisma.document.count({
    where: { ownerId: user.id, extractionStatus: "PENDING" },
  });

  // targetDate >= now already excludes documents with no date (null never
  // satisfies gte), so targetDate below is never null for these rows.
  const now = new Date();
  const upcoming = await prisma.document.findMany({
    where: { ownerId: user.id, targetDate: { gte: now } },
    orderBy: { targetDate: "asc" },
    take: 5,
    select: { id: true, fileName: true, category: true, targetDate: true },
  });

  const cards = categoryCards();

  const latestDocument = await prisma.document.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return (
    <div className="relative">
      <DashboardDecor />
      <div className="relative z-10">
        <div className="mb-10 border-b border-border pb-8">
          <p className="text-sm font-medium capitalize text-foreground-muted">
            {t("welcome", { name: user.displayName })}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
            {total > 0 && (
              <Link
                href="/documents/new"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                <PlusIcon />
                {t("import")}
              </Link>
            )}
          </div>
          <p className="mt-2 text-sm text-foreground-muted">
            {total === 0 ? t("empty") : t("countByCategory", { count: total, categories: countByCategory.size })}
          </p>
          <div className="mt-3">
            <HowItWorksDialog showOnArrival={total === 0} userId={user.id} />
          </div>
        </div>

        {pending > 0 && (
          <div className="mb-8 flex items-start gap-3 rounded-lg border border-border bg-surface-hover px-4 py-3 text-sm text-foreground-muted">
            <InfoIcon className="text-foreground-subtle" />
            {t("pendingClassification", { count: pending })}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              {t("upcomingDeadlines.title")}
            </h2>
            <div className="flex flex-col gap-3">
              {upcoming.map((doc) => {
                const category = doc.category as CategoryKey;
                const slug = CATEGORIES[category]?.slug ?? "other";
                return (
                  <Link key={doc.id} href={`/documents/view/${doc.id}`} className="group block">
                    <Card className="flex items-center justify-between gap-4 p-4 transition group-hover:border-primary">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${categoryBadgeClasses(category)}`}
                        >
                          <CategoryIcon category={category} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{doc.fileName}</p>
                          <p className="text-sm text-foreground-muted">{tCategory(`${slug}.label`)}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-foreground">
                          {format.dateTime(doc.targetDate!, { dateStyle: "short" })}
                        </p>
                        <p className="text-xs text-foreground-subtle">
                          {format.relativeTime(doc.targetDate!, now)}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {total === 0 ? (
          <UploadDropzone />
        ) : (
          <>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              {t("categoriesLabel")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => {
                const count = countByCategory.get(card.category) ?? 0;
                return (
                  <Link key={card.category} href={card.href} className="group block">
                    <Card className="h-full transition group-hover:border-primary group-hover:shadow-elevated">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full shadow-card ${categoryBadgeClasses(card.category)}`}
                        >
                          <CategoryIcon category={card.category} />
                        </span>
                        <Badge tone={count === 0 ? "neutral" : "primary"}>{count}</Badge>
                      </div>
                      <h3 className="mt-4 font-medium text-foreground">{tCategory(`${card.slug}.label`)}</h3>
                      <p className="mt-1 text-sm text-foreground-muted">
                        {tCategory(`${card.slug}.description`)}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                        <ArrowIcon />
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <AssistantSection latestDocumentId={latestDocument?.id ?? null} />
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: CategoryCard["category"] }) {
  switch (category) {
    case "IDENTITY":
      return <IdentityIcon />;
    case "INSURANCE_AUTO":
      return <InsuranceIcon />;
    case "OTHER":
      return <FolderIcon />;
  }
}

function categoryBadgeClasses(category: CategoryCard["category"]): string {
  switch (category) {
    case "IDENTITY":
      return "bg-gradient-to-br from-primary to-primary-hover text-primary-foreground";
    case "INSURANCE_AUTO":
      return "bg-gradient-to-br from-success to-success/70 text-primary-foreground";
    case "OTHER":
      return "bg-gradient-to-br from-foreground-muted to-foreground-subtle text-primary-foreground";
  }
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25h.008v.008h-.008v-.008ZM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6.75v-3.75"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function IdentityIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M3 7.5A2.25 2.25 0 0 1 5.25 5.25h13.5A2.25 2.25 0 0 1 21 7.5v9a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 16.5v-9Zm6.75 3.75a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-3.75 5.1a2.625 2.625 0 0 1 5.25 0 .75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75ZM14.25 9a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm-.75 3.75a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InsuranceIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 3.847 10.996 9.179 12.78a.75.75 0 0 0 .54 0c5.332-1.784 9.179-6.838 9.179-12.78 0-1.39-.233-2.736-.654-3.986a.75.75 0 0 0-.722-.516 11.209 11.209 0 0 1-7.878-3.08Zm3.094 8.16a.75.75 0 1 0-1.22-.86l-3.236 4.53-1.498-1.632a.75.75 0 1 0-1.102 1.016l2.144 2.335a.75.75 0 0 0 1.16-.078l3.752-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
    </svg>
  );
}
