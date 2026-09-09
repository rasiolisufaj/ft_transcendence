export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  deriveStatus,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/documents/status";

export default async function DashboardPage() {
  const documents = await prisma.document.findMany({
    include: { identity: true, insurance: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Documents</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track your French administrative paperwork and deadlines.
          </p>
        </div>
        <Link
          href="/documents/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add Document
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No documents yet. Add your first document to get started.
          </p>
          <Link
            href="/documents/new"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add Document
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const status = deriveStatus(doc);
            return (
              <div
                key={doc.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h2 className="font-medium">{doc.title}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <dl className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <dt>Category</dt>
                    <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                      {doc.category === "IDENTITY"
                        ? "Identity"
                        : "Insurance"}
                    </dd>
                  </div>
                  {doc.issuingAuthority && (
                    <div className="flex justify-between">
                      <dt>Issuer</dt>
                      <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                        {doc.issuingAuthority}
                      </dd>
                    </div>
                  )}
                  {doc.targetDate && (
                    <div className="flex justify-between">
                      <dt>
                        {doc.deadlineType === "HARD" ? "Expires" : "Renewal"}
                      </dt>
                      <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                        {doc.targetDate.toLocaleDateString("fr-FR")}
                      </dd>
                    </div>
                  )}
                  {doc.insurance?.coverageType && (
                    <div className="flex justify-between">
                      <dt>Type</dt>
                      <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                        {doc.insurance.coverageType}
                      </dd>
                    </div>
                  )}
                  {doc.identity?.documentNumber && (
                    <div className="flex justify-between">
                      <dt>Number</dt>
                      <dd className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {doc.identity.documentNumber}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
