"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { deleteAccount, type DeleteAccountState } from "./actions";

const initialState: DeleteAccountState = {};

export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("myData");
  const tAuth = useTranslations("auth");
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const fieldError = state.fieldErrors?.[hasPassword ? "password" : "email"]?.[0];
  // Literal t("…") calls: npm run i18n:check cannot see a key built at runtime.
  const errorText = {
    wrongPassword: t("wrongPassword"),
    wrongEmail: t("wrongEmail"),
    lastAdmin: t("lastAdmin"),
    tooManyAttempts: t("tooManyAttempts"),
  };

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {/* An account made by Google sign-in has no password: it confirms with its email (phase 8). */}
      {hasPassword ? (
        <Input
          label={t("passwordLabel")}
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldError && tAuth(`errors.${fieldError}`)}
        />
      ) : (
        <Input
          label={t("emailLabel")}
          name="email"
          type="email"
          autoComplete="off"
          error={fieldError && tAuth(`errors.${fieldError}`)}
        />
      )}
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