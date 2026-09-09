export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  const documents = await prisma.document.findMany({
    select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Documents</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Upload your French paperwork — our AI will handle the rest.
          </p>
        </div>
        <Link
          href="/documents/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Upload
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No documents yet. Upload your first document to get started.
          </p>
          <Link
            href="/documents/new"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Upload
          </Link>
        </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
