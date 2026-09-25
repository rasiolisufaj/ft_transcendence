import ChannelForm from "./ChannelForm";

export default function CreateChannelPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Créer un channel
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Crée un espace où les gens posent des questions et s'entraident sur un
          sujet.
        </p>

        <div className="mt-6">
          <ChannelForm />
        </div>
      </div>
    </main>
  );
}
