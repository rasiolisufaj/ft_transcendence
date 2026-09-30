import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { deleteChannel } from "./action";

export default async function DeleteChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.delete");
  const promise = await params;
  const idChannel = promise.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }
  const { user } = await requireUser();

  const moderator = await prisma.channelMember.findFirst({
    where: {
      channelId: id,
      userId: user.id,
      role: "MODERATOR",
    },
  });
  if (!moderator) {
    notFound();
  }

  const channel = await prisma.channel.findFirst({
    where: { id: id },
    include: { _count: { select: { members: true } } },
  });
  if (!channel) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/channels"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {t("back")}
      </Link>

      <div className="mt-4 rounded-2xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title", { channel: channel.title })}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t("warning", { count: channel._count.members })}
        </p>
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          {t("reminder")}
        </p>

        <form action={deleteChannel} className="mt-6 flex gap-3">
          <input type="hidden" name="deletechannel" value={channel.id} />
          <Link
            href="/channels"
            className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-center text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}