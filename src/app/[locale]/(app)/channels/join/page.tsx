export const dynamic = "force-dynamic";

import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getJoinableChannels } from "./data";
import { joinChannel } from "./actions";
import requestJoinChannel from "./actions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function JoinPage() {
  const t = await getTranslations("channels.join");
  const { user } = await requireUser();
  const channels = await getJoinableChannels(user.id);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <Link href="/channels" className="text-sm text-foreground-muted hover:text-foreground">
          {t("back")}
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{t("subtitle")}</p>

        {channels.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t("empty")} />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {channels.map((channel) => (
              <div key={channel.id} className="rounded-xl border border-border p-4">
                <h3 className="font-medium text-foreground">{channel.title}</h3>
                {channel.description ? (
                  <p className="text-sm text-foreground-muted">{channel.description}</p>
                ) : (
                  <p className="text-sm italic text-foreground-subtle">{t("noDescription")}</p>
                )}
                <p className="mt-1 text-xs text-foreground-subtle">
                  {t("membersCount", { count: channel._count.members })}
                </p>
                {channel.isPrivate ? (
                  <form action={requestJoinChannel} className="mt-3">
                    <input type="hidden" name="channelId" value={channel.id} />
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-primary hover:bg-primary-subtle"
                    >
                      {t("requestJoin")}
                    </button>
                  </form>
                ) : (
                  <form action={joinChannel} className="mt-3">
                    <input type="hidden" name="channelId" value={channel.id} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-success hover:bg-success-subtle"
                    >
                      {t("join")}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
