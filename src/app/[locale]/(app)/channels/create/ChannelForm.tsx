"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { createChannel, type CreateChannelState } from "./action";

function SubmitButton() {
  const t = useTranslations("channels.create");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {t("submit")}
    </button>
  );
}

export default function ChannelForm() {
  const t = useTranslations("channels.create");
  const [state, formAction] = useActionState<CreateChannelState, FormData>(
    createChannel,
    {},
  );

  return (
    <form className="flex flex-col gap-4" action={formAction}>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {t("nameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={100}
          placeholder={t("namePlaceholder")}
          className="rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {t("descriptionLabel")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={250}
          placeholder={t("descriptionPlaceholder")}
          className="resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="question"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {t("questionLabel")}
        </label>
        <textarea
          id="question"
          name="question"
          rows={3}
          required
          maxLength={300}
          placeholder={t("questionPlaceholder")}
          className="resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t("visibilityLabel")}
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="radio"
            name="visibility"
            value="public"
            defaultChecked
            required
          />
          <span>{t("visibilityPublic")}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="radio" name="visibility" value="private" />
          <span>{t("visibilityPrivate")}</span>
        </label>
      </fieldset>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-500"
        >
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <div className="mt-2 flex gap-3">
        <Link
          href="/channels"
          className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-center text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {t("cancel")}
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
