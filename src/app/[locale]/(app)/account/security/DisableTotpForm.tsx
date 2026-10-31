"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { disableTwoFactor, type DisableState } from "./actions";

const initialState: DisableState = {};

export function DisableTotpForm() {
  const t = useTranslations("security.twoFactor");
  const [state, formAction, pending] = useActionState(disableTwoFactor, initialState);

  if (state.success) {
    return (
      <p className="text-sm text-green-600 dark:text-green-400">
        {t("disable.success")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Input
        label={t("disable.codeLabel")}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        error={state.error ? t(`errors.${state.error}`) : undefined}
      />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? t("disable.pending") : t("disable.submit")}
      </Button>
    </form>
  );
}
