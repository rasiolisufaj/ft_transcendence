export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSeedUser } from "@/lib/auth/seed-user";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORIES, categoryFromSlug } from "@/lib/documents/subtypes";
import { deleteDocument } from "@/app/[locale]/action";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/documents/[category]">) {
  const { locale, category: slug } = await params;

  // Le slug vient de l'URL. Le registre est seul juge : un slug inconnu est un
  // 404, jamais une liste vide qui laisserait croire que la catégorie existe.
  const category = categoryFromSlug(slug);
  if (category === null) notFound();

  const def = CATEGORIES[category];
  const user = await getSeedUser();

  // Filtré dans la requête, pas dans le composant — exigence E6.
  const documents = await prisma.document.findMany({
    where: { ownerId: user.id, category },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/${locale}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Mes documents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{def.label}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{def.description}</p>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="Aucun document dans cette catégorie"
          description="Les documents importés y seront rangés automatiquement une fois l'analyse branchée."
          action={
            <Link
              href={`/${locale}/documents/new`}
              className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Ajouter un document
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {doc.fileType.includes("pdf") ? "PDF" : "IMG"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.fileName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatSize(doc.fileSize)} · {doc.createdAt.toLocaleDateString("fr-FR")}
                </p>
              </div>

              {doc.extractionStatus === "PENDING" && (
                <Badge tone="warning">En attente de classement</Badge>
              )}
              {doc.extractionStatus === "NEEDS_REVIEW" && (
                <Badge tone="warning">À vérifier</Badge>
              )}

              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Ouvrir ${doc.fileName}`}
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
                <Button variant="secondary" aria-label={`Supprimer ${doc.fileName}`}>
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
          ))}
        </div>
      )}
    </div>
  );
}
