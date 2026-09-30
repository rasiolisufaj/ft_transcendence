export const dynamic = "force-dynamic";

import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getSeedUser } from "@/lib/auth/seed-user";
import { getJoinableChannels } from "./data";
import { joinChannel } from "./actions";

export default async function JoinPage() {
  const t = await getTranslations("channels.join");
  const user = await getSeedUser();
  const channels = await getJoinableChannels(user.id);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/channels"
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          {t("back")}
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("subtitle")}
        </p>

        {channels.length === 0 ? (
          <p className="mt-6 text-sm italic text-zinc-400">{t("empty")}</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {channel.title}
                </h3>
                {channel.description ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {channel.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-zinc-400">
                    {t("noDescription")}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {t("membersCount", { count: channel._count.members })}
                </p>
                <form action={joinChannel} className="mt-3">
                  <input type="hidden" name="channelId" value={channel.id} />
                  <button
                    type="submit"
                    className="rounded-md px-3 py-2 text-sm text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                  >
                    {t("join")}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
