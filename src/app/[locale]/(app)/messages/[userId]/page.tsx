export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { areFriends, listMessages } from "@/lib/messages/messages";
import { MessagesLive } from "../MessagesLive";
import { MessageForm } from "./MessageForm";

export default async function ConversationPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const t = await getTranslations("chat");
  const format = await getFormatter();
  // The (app) layout is not a security boundary.
  const { user } = await requireUser();

  if (userId === user.id) {
    notFound();
  }
  const other = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } });
  if (!other) {
    notFound();
  }
  const [messages, canWrite] = await Promise.all([listMessages(user.id, other.id), areFriends(user.id, other.id)]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <MessagesLive from={other.id} />
      <div>
        <Link
          href="/messages"
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {t("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("with", { name: other.displayName })}</h1>
      </div>

      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("noMessages")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {messages.map((message) => {
            const mine = message.senderId === user.id;
            return (
              <li key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <p
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                    mine
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {message.content}
                </p>
                <time dateTime={message.createdAt.toISOString()} className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {format.dateTime(message.createdAt, { dateStyle: "short", timeStyle: "short" })}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {canWrite ? (
        <MessageForm userId={other.id} />
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("cannotWrite")}</p>
      )}
    </div>
  );
}
