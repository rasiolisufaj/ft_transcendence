import { prisma } from "@/lib/db";
import { getAllUsers } from "../../create/data";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { inviteUser } from "./action";
import { requireUser } from "@/lib/auth/session";

// revoir les commentaires plus tard
export default async function InviteUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.invite");
  // recupere
  const promise = await params;
  const idChannel = promise.id;
  const trueIdChannel = parseInt(idChannel, 10);

  if (
    Number.isNaN(trueIdChannel) ||
    trueIdChannel <= 0 ||
    String(trueIdChannel) !== idChannel
  ) {
    return;
  }
  const { user } = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: { id: trueIdChannel },
  });

  if (!channel) return;
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
  const users = await getAllUsers();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/channels"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {t("back")}
      </Link>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title", { channel: channel.title })}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("subtitle")}
        </p>

        <form className="mt-6 flex flex-col gap-3" action={inviteUser}>
          <input type="hidden" name="channelId" value={channel.id} />

          <select
            name="userId"
            required
            defaultValue=""
            aria-label={t("userAria")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              {t("chooseUser")}
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
            {t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
