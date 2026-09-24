import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { createAnswer, deleteAnswer } from "../actions";

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const promise = await params;
  const idChannel = promise.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const channel = await prisma.channel.findFirst({
    where: {
      id: id,
      members: { some: { userId: user.id, role: "MODERATOR" } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      threads: {
        select: { id: true, content: true },
      },
    },
  });

  if (!channel) {
    notFound();
  }
  const question = channel.threads[0];
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Modifier le channel
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Change le nom, la description ou la question.
        </p>

        <form className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="channelId" value={channel.id} />
          <input type="hidden" name="questionId" value={question?.id ?? ""} />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="name"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Nom du channel
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={99}
              defaultValue={channel.title}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="description"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Description (optionnelle)
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={250}
              defaultValue={channel.description ?? ""}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="question"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Question
            </label>
            <textarea
              id="question"
              name="question"
              rows={4}
              required
              maxLength={300}
              defaultValue={question?.content}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Link
              href="/channels"
              className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Annuler
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
