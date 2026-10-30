export const dynamic = "force-dynamic";

import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/messages/messages";
import { MessagesLive } from "./MessagesLive";

export default async function MessagesPage() {
  const t = await getTranslations("chat");
  const format = await getFormatter();
  // The (app) layout is not a security boundary.
  const { user } = await requireUser();
  const conversations = await listConversations(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <MessagesLive />
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
      </div>

      {conversations.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.other.id}`}
                className="block px-4 py-3 hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:focus-visible:bg-zinc-800/50"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-sm font-medium">{conversation.other.displayName}</span>
                  <time
                    dateTime={conversation.updatedAt.toISOString()}
                    className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {format.dateTime(conversation.updatedAt, { dateStyle: "short", timeStyle: "short" })}
                  </time>
                </div>
                {conversation.lastMessage ? (
                  <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {conversation.lastMessage.senderId === user.id
                      ? t("youSaid", { content: conversation.lastMessage.content })
                      : conversation.lastMessage.content}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
