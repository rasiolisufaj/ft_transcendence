import { prisma } from "@/lib/db";
import { getAllUsers } from "../../create/data";
import Link            from "next/link";
// revoir les commentaires plus tard
export default async function InviteUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // recupere
  const promise = await params;
  const idChannel = promise.id;
  const trueIdChannel = parseInt(idChannel, 10);

  // verifie lid du channel
  if (
    Number.isNaN(trueIdChannel) ||
    trueIdChannel <= 0 ||
    String(trueIdChannel) !== idChannel
  ) {
    return;
  }
  // cherche le user
  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const channel = await prisma.channel.findFirst({
    where: { id: trueIdChannel },
  });

  if (!channel) return;
  // vérifie que l'utilisateur est modérateur de ce channel
  const moderator = await prisma.channelMember.findFirst({
    where: {
      channelId: channel.id,
      userId: user.id,
      role: "MODERATOR",
    },
  });
  if (!moderator) {
    return;
  }
  // recupere tout les user du site
  const users = await getAllUsers();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/channels"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Retour aux channels
      </Link>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Inviter dans {channel.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choisis une personne à inviter.
        </p>

        <form className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="channelId" value={channel.id} />

          <select
            name="userId"
            required
            defaultValue=""
            aria-label="Utilisateur à inviter"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Choisir un utilisateur…
            </option>
            {users.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName} ({person.email})
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Inviter
          </button>
        </form>
      </div>
    </main>
  );
}
