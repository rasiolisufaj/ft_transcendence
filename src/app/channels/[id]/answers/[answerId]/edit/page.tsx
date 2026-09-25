import Link from "next/link";
import { editAnswer } from "../../../actions";
import { notFound } from "next/navigation";



// page edit message recupere lid du channel
// recupre lid du message 
export default async function EditAnswerPage({
  params,
}: {
  params: Promise<{ id: string; answerId: string }>;
}) {
 
    const promise = await params;
    const idChannel = promise.id;
    const answerId = promise.answerId;

    if(typeof idChannel !== "string" || typeof answerId !== "string" || typeof )
    const id = parseInt(idChannel, 10);

    if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
        notFound();
    }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Modifier ma réponse</h1>

      <form action={editAnswer} className="flex flex-col gap-3">
        {/* id de la réponse, envoyé à l'action */}
        <input type="hidden" name="answerId" value={answer.id} />

        {/* l'ancien texte est déjà écrit dedans */}
        <textarea
          name="content"
          defaultValue={answer.content}
          required
          maxLength={1000}
          rows={5}
          className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <div className="flex justify-end gap-2">
          <Link
            href={`/channels/${channelId}`}
            className="rounded-lg px-4 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Annuler
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </main>
  );
}