import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getUserChannels } from "./create/data";
import { requireUser } from "@/lib/auth/session";
import { leaveChannel } from "./[id]/actions";
import { can } from "@/lib/auth/policy";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardDecor } from "@/components/dashboard/DashboardDecor";

export default async function ChannelsHomePage() {
  const t = await getTranslations("channels.home");
  const ctx = await requireUser();
  const channelsMember = await getUserChannels(ctx.user.email);
  return (
    <div className="relative">
      <DashboardDecor />
      <div className="relative z-10">
        <div className="mb-10 border-b border-border pb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">{t("subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/channels/create"
            className="group block rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-elevated"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
              <PlusCircleIcon />
            </span>
            <h2 className="mt-4 font-medium text-foreground">{t("createTitle")}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{t("createDesc")}</p>
          </Link>

          <Link
            href="/channels/join"
            className="group block rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-elevated"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success to-success/70 text-primary-foreground">
              <JoinIcon />
            </span>
            <h2 className="mt-4 font-medium text-foreground">{t("joinTitle")}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{t("joinDesc")}</p>
          </Link>

          <Link
            href="/channels/invitations"
            className="group block rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-elevated"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-foreground-muted to-foreground-subtle text-primary-foreground">
              <EnvelopeIcon />
            </span>
            <h2 className="mt-4 font-medium text-foreground">{t("invitationsTitle")}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{t("invitationsDesc")}</p>
          </Link>
        </div>

        {channelsMember.length > 0 && (
          <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            {t("myChannels")}
          </h2>
        )}

        {channelsMember.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {channelsMember.map((channel) => (
            <Card key={channel.id} className="flex items-start justify-between gap-4">
              <Link href={`/channels/${channel.id}`} className="group flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground ${channelAvatarClasses(channel.id)}`}
                >
                  {channel.title.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-foreground group-hover:underline">
                    {channel.title}
                  </h3>
                  {channel.description && (
                    <p className="line-clamp-2 text-sm text-foreground-muted">{channel.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-foreground-subtle">
                      {t("membersCount", { count: channel._count.members })}
                    </span>
                    {channel.isClosed ? (
                      <Badge tone="neutral">{t("closed")}</Badge>
                    ) : (
                      <Badge tone={channel.isPrivate ? "neutral" : "primary"}>
                        {channel.isPrivate ? t("private") : t("public")}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>

              <details className="relative shrink-0">
                <summary
                  aria-label={t("optionsAria")}
                  className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-hover [&::-webkit-details-marker]:hidden"
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
                {/* Each link asks can() the same question as the page it opens. Since phase 6
                    a moderator need not be the creator, so Delete is not every moderator's. */}
                <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-border bg-surface p-1 shadow-elevated">
                  {channel.isPrivate && can(ctx, "channel:moderate", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/invite`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
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
                          d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                        />
                      </svg>
                      {t("invite")}
                    </Link>
                  )}
                  {can(ctx, "channel:delete", { channelId: channel.id, ownerUserId: channel.createdBy }) && (
                    <Link
                      href={`/channels/${channel.id}/delete`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
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
                      {t("delete")}
                    </Link>
                  )}
                  {can(ctx, "channel:update", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/edit`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
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
                      {t("edit")}
                    </Link>
                  )}
                  {channel.isPrivate && can(ctx, "channel:moderate", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/requests`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <circle cx="9" cy="8" r="3.5" />
                        <path
                          strokeLinecap="round"
                          d="M2.5 20a6.5 6.5 0 0 1 13 0"
                        />
                        <path strokeLinecap="round" d="M19 8v6M16 11h6" />
                      </svg>
                      {t("requests")}
                    </Link>
                  )}
                  {can(ctx, "channel:moderate", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/kick`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
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
                          d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                        />
                      </svg>
                      {t("kick")}
                    </Link>
                  )}
                  {/* Everyone listed here is a member, and every member may leave. */}
                  <form action={leaveChannel}>
                    <input type="hidden" name="channelId" value={channel.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
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
                          d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                        />
                      </svg>
                      {t("leave")}
                    </button>
                  </form>
                </div>
              </details>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <EmptyState title={t("empty")} />
          </div>
        )}
      </div>
    </div>
  );
}

function PlusCircleIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function JoinIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3-3-3-3m3 3H9m3 3 3-3"
      />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
      />
    </svg>
  );
}

function channelAvatarClasses(id: number): string {
  const gradients = [
    "bg-gradient-to-br from-primary to-primary-hover",
    "bg-gradient-to-br from-success to-success/70",
    "bg-gradient-to-br from-warning to-warning/70",
  ];
  return gradients[id % gradients.length]!;
}
