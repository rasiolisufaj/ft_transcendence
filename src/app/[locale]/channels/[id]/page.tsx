import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { createAnswer, deleteAnswer, kickMember, leaveChannel } from "./actions";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.detail");
  const format = await getFormatter();
  const p = await params;
  const idChannel = p.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }

  const user = await prisma.user.findFirst({
    where: { email: "Amir@gmail.com" },
  });
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const channel = await prisma.channel.findFirst({
    where: {
      id: id,
      members: { some: { userId: user.id } },
    },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { displayName: true } } },
      },
      threads: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { displayName: true } },
          answers: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });

  if (!channel) {
    notFound();
  }
  const question = channel.threads[0];
  const isModerator = channel.members.some(
    (member) => member.userId === user.id && member.role === "MODERATOR",
  );
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
      <form action={leaveChannel} className="mt-4">
        <input type="hidden" name="channelId" value={channel.id} />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
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

      <h2 className="mt-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t("membersCount", { count: channel.members.length })}
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {channel.members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            <span className="text-zinc-700 dark:text-zinc-300">
              {member.user.displayName}
              {member.role === "MODERATOR" && (
                <span className="ml-2 text-xs text-zinc-400">
                  {t("moderator")}
                </span>
              )}
            </span>

            {isModerator && member.role !== "MODERATOR" && (
              <form action={kickMember}>
                <input type="hidden" name="channelId" value={channel.id} />
                <input type="hidden" name="userId" value={member.userId} />
                <button
                  type="submit"
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {t("kick")}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {question ? (
        <>
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {question.content}
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              {t("authoredBy", {
                name: question.author?.displayName ?? t("deletedUser"),
                date: format.dateTime(question.createdAt, {
                  dateStyle: "short",
                }),
              })}
            </p>
          </div>
          <h2 className="mt-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t("repliesCount", { count: question.answers.length })}
          </h2>
          {question.answers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              {t("noReplies")}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {question.answers.map((answer) => (
                <li
                  key={answer.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {answer.content}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {answer.author?.displayName ?? t("deletedUser")}
                    </p>
                    <p>
                      {format.dateTime(answer.createdAt, {
                        dateStyle: "short",
                      })}
                    </p>
                  </div>

                  {answer.userId === user.id && (
                    <div className="flex shrink-0 gap-1">
                      <Link
                        href={`/channels/${channel.id}/answers/${answer.id}/edit`}
                        aria-label={t("editReplyAria")}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
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
                      </Link>

                      <form action={deleteAnswer}>
                        <input
                          type="hidden"
                          name="answerId"
                          value={answer.id}
                        />
                        <button
                          type="submit"
                          aria-label={t("deleteReplyAria")}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
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
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form
            className="sticky bottom-0 mt-6 flex gap-2 border-t border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-950"
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
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />

            <Button type="submit">{t("send")}</Button>
          </form>
        </>
      ) : (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {t("noQuestion")}
        </p>
      )}
    </main>
  );
}
