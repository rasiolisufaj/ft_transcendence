export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";
import { Link } from "@/i18n/navigation";
import { getChannelJoinRequests } from "./data";
import { acceptJoinRequest, rejectJoinRequest } from "./action";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ChannelRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const urlParams = await params;
  const idChannel = urlParams.id;
  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }

  const ctx = await requireUser();
  // The same check as acceptJoinRequest / rejectJoinRequest.
  if (!can(ctx, "channel:moderate", { channelId: id })) {
    notFound();
  }

  const requests = await getChannelJoinRequests(id);
  const format = await getFormatter();
  const t = await getTranslations("channels.requests");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        {/* The channel page 404s for a non-member (an admin), so their way back is the list */}
        <Link
          href={ctx.memberships.some((m) => m.channelId === id) ? `/channels/${id}` : "/channels"}
          className="text-sm text-foreground-muted hover:text-foreground"
        >
          {t("back")}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{t("subtitle")}</p>

        {requests.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t("empty")} />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {requests.map((request) => (
              <div
                key={request.userId}
                className="flex items-center justify-between rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{request.user.displayName}</p>
                  <p className="text-xs text-foreground-subtle">
                    {format.dateTime(request.createdAt, {
                      dateStyle: "short",
                    })}{" "}
                  </p>
                </div>

                <div className="flex gap-2">
                  <form action={acceptJoinRequest}>
                    <input type="hidden" name="channelId" value={id} />
                    <input type="hidden" name="userId" value={request.userId} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-success hover:bg-success-subtle"
                    >
                      {t("accept")}
                    </button>
                  </form>
                  <form action={rejectJoinRequest}>
                    <input type="hidden" name="channelId" value={id} />
                    <input type="hidden" name="userId" value={request.userId} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
                    >
                      {t("reject")}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
