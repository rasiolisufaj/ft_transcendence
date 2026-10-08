export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { categoryCards, type CategoryKey } from "@/lib/documents/subtypes";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tCategory = await getTranslations("categories");
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

  const cards = categoryCards();

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total === 0 ? t("empty") : t("countByCategory", { count: total })}
          </p>
        </div>
        <Link
          href="/documents/new"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const count = countByCategory.get(card.category) ?? 0;
          return (
            <Link key={card.category} href={card.href} className="group block">
              <Card className="h-full transition group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium">{tCategory(`${card.slug}.label`)}</h2>
                  <Badge tone={count === 0 ? "neutral" : "success"}>{count}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {tCategory(`${card.slug}.description`)}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      {pending > 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {t("pendingClassification", { count: pending })}
        </p>
      )}
    </div>
  );
}
