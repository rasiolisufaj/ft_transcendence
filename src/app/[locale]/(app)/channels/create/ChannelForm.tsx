"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { createChannel } from "./action";

const fieldClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary";

export default function ChannelForm() {
  const t = useTranslations("channels.create");
  return (
    <form className="flex flex-col gap-4" action={createChannel}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          {t("nameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={50}
          placeholder={t("namePlaceholder")}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          {t("descriptionLabel")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder={t("descriptionPlaceholder")}
          className={`resize-none ${fieldClass}`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="question" className="text-sm font-medium text-foreground">
          {t("questionLabel")}
        </label>
        <textarea
          id="question"
          name="question"
          rows={3}
          placeholder={t("questionPlaceholder")}
          className={`resize-none ${fieldClass}`}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-foreground">{t("visibilityLabel")}</legend>
        <div className="flex gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground has-checked:border-primary has-checked:bg-primary-subtle has-checked:text-primary-subtle-foreground">
            <input type="radio" name="visibility" value="public" defaultChecked className="accent-primary" />
            {t("public")}
          </label>

          <label className="flex flex-1 items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground has-checked:border-primary has-checked:bg-primary-subtle has-checked:text-primary-subtle-foreground">
            <input type="radio" name="visibility" value="private" className="accent-primary" />
            {t("private")}
          </label>
        </div>
      </fieldset>

      <div className="mt-2 flex gap-3">
        <Link
          href="/channels"
          className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm text-foreground-muted transition hover:border-border-strong hover:text-foreground"
        >
          {t("cancel")}
        </Link>
        <Button type="submit" className="flex-1">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
