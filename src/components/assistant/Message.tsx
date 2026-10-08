"use client";

const userBubble =
  "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const assistantBubble =
  "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";

export function Message({
  role,
  content,
  streaming = false,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className={role === "user" ? "flex justify-end" : "flex justify-start"}>
      <div className={role === "user" ? userBubble : assistantBubble}>
        {content ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : streaming ? (
          <span className="inline-block animate-pulse text-zinc-400 dark:text-zinc-500">…</span>
        ) : null}
        {streaming && content ? (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />
        ) : null}
      </div>
    </div>
  );
}
