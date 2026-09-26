export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSeedUser } from "@/lib/auth/seed-user";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { categoryCards, type CategoryKey } from "@/lib/documents/subtypes";

export default async function DashboardPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const user = await getSeedUser();

  // Un seul aller-retour pour toutes les cartes. Une requête par carte serait le
  // N+1 que A7 interdit, et le coût grandirait à chaque catégorie ajoutée.
  const grouped = await prisma.document.groupBy({
    by: ["category"],
    where: { ownerId: user.id },
    _count: { _all: true },
  });

  const countByCategory = new Map<CategoryKey, number>(
    grouped.map((row) => [row.category as CategoryKey, row._count._all]),
  );
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  // Les documents que l'IA n'a pas encore classés. Tant que la classification
  // n'est pas branchée, c'est tout le stock — l'afficher évite de laisser croire
  // que « Autres » est un choix de rangement plutôt qu'une attente.
  const pending = await prisma.document.count({
    where: { ownerId: user.id, extractionStatus: "PENDING" },
  });

  const cards = categoryCards(locale);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mes documents</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total === 0
              ? "Aucun document pour l'instant."
              : `${total} document${total > 1 ? "s" : ""} — rangés par catégorie.`}
          </p>
        </div>
        <Link
          href={`/${locale}/documents/new`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ajouter un document
        </Link>
      </div>

      {/* Une carte par entrée du registre : ajouter une catégorie la fait
          apparaître ici sans toucher à ce fichier. */}
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
          {pending} document{pending > 1 ? "s" : ""} en attente de classement automatique.
        </p>
      )}
    </div>
  );
}
