import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { kickMembers } from "./action";

export default async function kickUser({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.kick");
  const promise = await params;
  const idChannel = promise.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }
  const { user } = await requireUser();

  const userMember = await prisma.channelMember.findFirst({
    where: {
      userId: user.id,
      channelId: id,
    },
  });
  // verifie que le user est bien membre du channel
  // et quil est bien moderator
  if (!userMember || userMember.role !== "MODERATOR") return;

  const channel = await prisma.channel.findFirst({
    where: {
      id: id,
    },
    include: {
      members: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });
  if (!channel) return;

  const member = channel.members;
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/channels"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {t("back")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {channel.title}
      </h1>
      {channel.description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {channel.description}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-400">
        {t("membersCount", { count: member.length })}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {member.map((membre) => (
          <div
            key={membre.userId}
            className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <form
              action={kickMembers}
              className="flex w-full items-center justify-between gap-4"
            >
              <input type="hidden" name="channelId" value={channel.id} />
              <input type="hidden" name="userId" value={membre.userId} />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {membre.user.displayName}
                </h1>
                <p className="mt-1 text-xs text-zinc-400">{membre.role}</p>
              </div>
              <button
                type="submit"
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                {t("kick")}
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
