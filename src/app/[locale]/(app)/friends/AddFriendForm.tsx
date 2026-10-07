"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { FriendFormState } from "@/lib/friends/schemas";
import { addFriend } from "./actions";

const initialState: FriendFormState = {};

export function AddFriendForm() {
  const t = useTranslations("friends");
  const [state, formAction, pending] = useActionState(addFriend, initialState);

  return (
    // noValidate: show the schema's translated messages.
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
      <div className="flex-1">
        <Input
          label={t("add.label")}
          name="email"
          type="email"
          autoComplete="off"
          required
          error={state.error ? t(`errors.${state.error}`) : undefined}
        />
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-7">
        {pending ? t("add.pending") : t("add.submit")}
      </Button>
      {state.sent ? (
        <p role="status" className="text-sm text-green-700 sm:mt-9 dark:text-green-400">
          {t("add.sent")}
        </p>
      ) : null}
    </form>
  );
}
