import Link from "next/link";
import { getUserChannels } from "./create/data";
import { deleteChannel } from "./create/action";

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
              src="/icons/channel/channel-create.svg"
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
              src="/icons/channel/channel-join.svg"
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
              src="/icons/channel/channel-invite.svg"
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
              className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <Link
                href={`/channels/${channel.id}`}
                className="group min-w-0 flex-1"
              >
                <h3 className="font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
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
              </Link>

              <details className="relative">
                <summary
                  aria-label="Options du channel"
                  className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden"
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
                      d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                    />
                  </svg>
                </summary>

                <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <Link
                    href={`/channels/${channel.id}/edit`}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="size-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                      />
                    </svg>
                    Modifier
                  </Link>

                  <form action={deleteChannel}>
                    <input
                      type="hidden"
                      name="deletechannel"
                      value={channel.id}
                    />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      Supprimer
                    </button>
                  </form>
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Tu n'appartiens à aucun channel.
        </p>
      )}
    </main>
  );
}
