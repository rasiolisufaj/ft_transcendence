import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { DashboardDecor } from "@/components/dashboard/DashboardDecor";
import {
  createAnswer,
  deleteAnswer,
  leaveChannel,
  toggleCloseChannel,
} from "./actions";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";
import { listFriendships } from "@/lib/friends/friendships";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.detail");
  const tHome = await getTranslations("channels.home");
  const format = await getFormatter();
  const p = await params;
  const idChannel = p.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }

  const ctx = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: {
      id: id,
      members: { some: { userId: ctx.user.id } },
    },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { displayName: true } } },
      },
      threads: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, displayName: true, avatar: { select: { updatedAt: true } } },
          },
          answers: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: { id: true, displayName: true, avatar: { select: { updatedAt: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!channel) {
    notFound();
  }

  const { friends } = await listFriendships(ctx.user.id);
  const friendIds = new Set(friends.map((friend) => friend.id));
  const friendsInChannel = channel.members.filter((member) => friendIds.has(member.userId)).length;

  const question = channel.threads[0];

  const canToggleClose = can(ctx, "channel:delete", {
    channelId: channel.id,
    ownerUserId: channel.createdBy,
  });
  return (
    <div className="relative">
      <DashboardDecor />
      <div className="relative z-10">
        <Link href="/channels" className="text-sm text-foreground-muted hover:text-foreground">
          {t("back")}
        </Link>

        <div className="mb-10 mt-3 border-b border-border pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
                {channel.title}
              </h1>
              {channel.description && (
                <p className="mt-2 text-sm text-foreground-muted">{channel.description}</p>
              )}
              {channel.isClosed && (
                <p className="mt-2 inline-block rounded-md border border-border bg-surface-hover px-2 py-0.5 text-xs text-foreground-muted">
                  {tHome("closed")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {canToggleClose && (
                <form action={toggleCloseChannel}>
                  <input type="hidden" name="channelId" value={channel.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground-muted transition hover:border-border-strong hover:bg-surface-hover"
                  >
                    {channel.isClosed ? tHome("reopen") : tHome("close")}
                  </button>
                </form>
              )}
              <form action={leaveChannel}>
                <input type="hidden" name="channelId" value={channel.id} />
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-danger transition hover:border-danger hover:bg-danger-subtle"
                >
                  <LeaveIcon />
                  {t("leave")}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{t("membersCount", { count: channel.members.length })}</Badge>
            <Badge tone={friendsInChannel > 0 ? "primary" : "neutral"}>
              {t("friendsCount", { count: friendsInChannel })}
            </Badge>
          </div>
        </div>

        {question ? (
          <>
            <Card className="bg-surface-hover">
              <p className="font-medium text-foreground">{question.content}</p>
              <p className="mt-2 text-xs text-foreground-subtle">
                {t("authoredByPrefix")}{" "}
                {question.author ? (
                  <Link href={`/users/${question.author.id}`} className="font-medium text-foreground hover:underline">
                    {question.author.displayName}
                  </Link>
                ) : (
                  t("deletedUser")
                )}{" "}
                {t("authoredByDate", {
                  date: format.dateTime(question.createdAt, { dateStyle: "short" }),
                })}
              </p>
            </Card>
            <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              {t("repliesCount", { count: question.answers.length })}
            </h2>
            {question.answers.length === 0 ? (
              <p className="text-sm text-foreground-muted">{t("noReplies")}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {question.answers.map((answer) => {
                  const isOwn = answer.userId === ctx.user.id;
                  const authorName = answer.author?.displayName ?? t("deletedUser");
                  const avatarSrc = answer.author?.avatar
                    ? `/api/users/${answer.author.id}/avatar?v=${answer.author.avatar.updatedAt.getTime()}`
                    : null;
                  const canUpdate = can(ctx, "answer:update", { ownerUserId: answer.userId });
                  const canDelete = can(ctx, "answer:delete", {
                    channelId: channel.id,
                    ownerUserId: answer.userId,
                  });

                  return (
                    <li
                      key={answer.id}
                      className={`flex items-start gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                    >
                      {!isOwn && <Avatar name={authorName} src={avatarSrc} size="sm" />}
                      <div className={`flex max-w-[75%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                        {!isOwn && (
                          <span className="mb-1 px-1 text-xs font-medium text-foreground-muted">
                            {answer.author ? (
                              <Link href={`/users/${answer.author.id}`} className="hover:text-foreground hover:underline">
                                {authorName}
                              </Link>
                            ) : (
                              authorName
                            )}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm ${
                            isOwn
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm border border-border bg-surface text-foreground"
                          }`}
                        >
                          {answer.content}
                        </div>
                        <div
                          className={`mt-1 flex items-center gap-2 px-1 text-xs text-foreground-subtle ${isOwn ? "flex-row-reverse" : ""}`}
                        >
                          <span>
                            {new Date(answer.updatedAt).getTime() -
                              new Date(answer.createdAt).getTime() >
                            1000
                              ? t("editedAt", {
                                  time: format.dateTime(new Date(answer.updatedAt), {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }),
                                })
                              : t("sentAt", {
                                  time: format.dateTime(new Date(answer.createdAt), {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }),
                                })}
                          </span>
                          {/* answer:delete covers everyone answer:update does (the author, an admin)
                              plus this channel's moderators, so it gates the whole group */}
                          {canDelete && (
                            <span className="flex items-center gap-0.5">
                              {canUpdate && (
                                <Link
                                  href={`/channels/${channel.id}/answers/${answer.id}/edit`}
                                  aria-label={t("editReplyAria")}
                                  className="rounded-md p-1 text-foreground-subtle hover:bg-primary-subtle hover:text-primary"
                                >
                                  <EditIcon />
                                </Link>
                              )}
                              <form action={deleteAnswer}>
                                <input type="hidden" name="answerId" value={answer.id} />
                                <button
                                  type="submit"
                                  aria-label={t("deleteReplyAria")}
                                  className="rounded-md p-1 text-foreground-subtle hover:bg-danger-subtle hover:text-danger"
                                >
                                  <TrashIcon />
                                </button>
                              </form>
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {channel.isClosed ? null : (
              <form
                className="sticky bottom-0 mt-6 flex gap-2 border-t border-border bg-background py-4"
                action={createAnswer}
              >
                <input type="hidden" name="threadId" value={question.id} />

                <input
                  type="text"
                  name="content"
                  required
                  maxLength={300}
                  placeholder={t("replyPlaceholder")}
                  aria-label={t("replyAria")}
                  autoComplete="off"
                  className="flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary"
                />

                <Button type="submit">{t("send")}</Button>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-foreground-muted">{t("noQuestion")}</p>
        )}
      </div>
    </div>
  );
}

function LeaveIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}
