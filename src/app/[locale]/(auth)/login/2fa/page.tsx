"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { verifyTwoFactor, type TwoFactorState } from "./actions";

const initialState: TwoFactorState = {};

export default function TwoFactorPage() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(verifyTwoFactor, initialState);
  const [code, setCode] = useState("");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">{t("twoFactor.title")}</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {t("twoFactor.description")}
      </p>

      <form action={formAction} className="mt-6 space-y-4" noValidate>
        <Input
          label={t("twoFactor.codeLabel")}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={state.error ? t(`errors.${state.error}`) : undefined}
        />

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("twoFactor.pending") : t("twoFactor.submit")}
        </Button>
      </form>

      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        {t("twoFactor.recoveryHint")}
      </p>
    </div>
  );
}
