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
  const passwordError = state.fieldErrors?.password?.[0];
  // Literal t("…") calls: npm run i18n:check cannot see a key built at runtime.
  const errorText = {
    wrongPassword: t("wrongPassword"),
    lastAdmin: t("lastAdmin"),
    tooManyAttempts: t("tooManyAttempts"),
  };

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      <Input
        label={t("passwordLabel")}
        name="password"
        type="password"
        autoComplete="current-password"
        error={passwordError && tAuth(`errors.${passwordError}`)}
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorText[state.error]}
        </p>
      )}
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