"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_MESSAGE_LENGTH, type MessageFormState } from "@/lib/messages/schemas";
import { sendMessageAction } from "./actions";

const initialState: MessageFormState = {};

export function MessageForm({ userId }: { userId: string }) {
  const t = useTranslations("chat");
  const [state, formAction, pending] = useActionState(sendMessageAction, initialState);
  const id = useId();

  return (
    // noValidate: show the schema's translated messages.
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("label")}
        </label>
        <textarea
          id={id}
          name="content"
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? `${id}-error` : undefined}
          className={`w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 ${
            state.error ? "border-red-500 focus:ring-red-500" : "border-zinc-300 dark:border-zinc-700"
          }`}
        />
        {state.error ? (
          <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">
            {t(`errors.${state.error}`)}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}
