import Link from "next/link";
import { getUserChannels } from "./create/data";
export default async function ChannelsHomePage() {
  const channelsMenber = await getUserChannels("Amir@gmail.com");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Channels
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Pose des questions, partage tes astuces et aide les autres avec leurs
          papiers.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/channels/create"
            className="flex items-center gap-4 rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
          >
            <img
              src="/icons/channel-create.svg"
              alt=""
              className="h-6 w-6 shrink-0"
            />
            <div>
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                Créer un channel
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Crée un espace pour parler d'un sujet.
              </p>
            </div>
          </Link>

          <Link
            href="/channels/join"
            className="flex items-center gap-4 rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
          >
            <img
              src="/icons/channel-join.svg"
              alt=""
              className="h-6 w-6 shrink-0"
            />
            <div>
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                Rejoindre un channel
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Parcours les channels publics et rejoins-en un.
              </p>
            </div>
          </Link>

          <Link
            href="/channels/invite"
            className="flex items-center gap-4 rounded-xl border border-zinc-200 p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
          >
            <img
              src="/icons/channel-invite.svg"
              alt=""
              className="h-6 w-6 shrink-0"
            />
            <div>
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                Demander une invitation
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Demande l'accès à un channel privé.
              </p>
            </div>
          </Link>
        </div>
      </div>
      {channelsMenber.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          {channelsMenber.map((channel) => (
            <div
              key={channel.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                {channel.title}
              </h3>
              {channel.description && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {channel.description}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                {channel._count.members} membre(s)
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Tu n'appartiens à aucun channel.
        </p>
      )}{" "}
    </main>
  );
}
