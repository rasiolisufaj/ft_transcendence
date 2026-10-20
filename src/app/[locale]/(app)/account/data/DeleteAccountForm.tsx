"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { deleteAccount, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = {};

export function DeleteAccountForm() {
  const t = useTranslations("myData");
  const tAuth = useTranslations("auth");
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name]?.[0];
    return key && tAuth(`errors.${key}`);
  };

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      <Input
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="current-password"
        error={fieldError("password")}
      />
      {state.error === "wrongPassword" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t("wrongPassword")}
        </p>
      ) : state.error === "lastAdmin" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t("lastAdmin")}
        </p>
      ) : state.error === "tooManyAttempts" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t("tooManyAttempts")}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? t("deletePending") : t("deleteButton")}
      </button>
    </form>
  );
}