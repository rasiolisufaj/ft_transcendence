"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Message } from "@/components/assistant/Message";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AssistantChunk =
  | { type: "token"; text: string }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number } }
  | { type: "error"; code: string; messageKey: string };

export function Chat({ documentId }: { documentId: number }) {
  const t = useTranslations("assistant");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/documents/${documentId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t("errors.upstream"));
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError(t("errors.upstream"));
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          let chunk: AssistantChunk;
          try {
            chunk = JSON.parse(json) as AssistantChunk;
          } catch {
            continue;
          }

          if (chunk.type === "token") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + chunk.text } : m)),
            );
          } else if (chunk.type === "error") {
            const errorMap: Record<string, string> = {
              "assistant.errors.noKey": t("errors.noKey"),
              "assistant.errors.rateLimited": t("errors.rateLimited"),
              "assistant.errors.upstream": t("errors.upstream"),
              "assistant.errors.overloaded": t("errors.overloaded"),
            };
            setError(errorMap[chunk.messageKey] ?? t("errors.upstream"));
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(t("errors.upstream"));
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} role={msg.role} content={msg.content} streaming={streaming && msg === messages.at(-1) && msg.role === "assistant"} />)
        )}
      </div>

      {error ? (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          />
          {streaming ? (
            <Button type="button" variant="secondary" onClick={handleStop}>
              {t("stop")}
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              {t("send")}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{t("disclaimer")}</p>
      </form>
    </div>
  );
}
