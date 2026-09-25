export const dynamic = "force-dynamic";

import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { getSeedUser } from "@/lib/auth/seed-user";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { categoryCards, type CategoryKey } from "@/lib/documents/subtypes";

export default async function DashboardPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const user = await getSeedUser();

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

  const cards = categoryCards(locale);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My documents</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total === 0
              ? "No documents yet."
              : `${total} document${total > 1 ? "s" : ""}, sorted by category.`}
          </p>
        </div>
        <Link
          href="/documents/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add a document
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const count = countByCategory.get(card.category) ?? 0;
          return (
            <Link key={card.category} href={card.href} className="group block">
              <Card className="h-full transition group-hover:border-zinc-400 dark:group-hover:border-zinc-600">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium">{card.label}</h2>
                  <Badge tone={count === 0 ? "neutral" : "success"}>{count}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {card.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      {pending > 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {pending} document{pending > 1 ? "s" : ""} awaiting automatic classification.
        </p>
      )}
    </div>
  );
}
