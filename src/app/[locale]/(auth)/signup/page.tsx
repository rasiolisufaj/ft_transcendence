"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Link } from "@/i18n/navigation";
import type { AuthFormState } from "@/lib/auth/schemas";
import { signup } from "./actions";

const initialState: AuthFormState = {};

export default function SignupPage() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signup, initialState);
  // Controlled so a rejected password does not also wipe these (React resets
  // uncontrolled fields after every action). The password is left to be cleared.
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const fieldError = (name: string) => {
    const key = state.fieldErrors?.[name]?.[0];
    return key && t(`errors.${key}`);
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">{t("signup.title")}</h1>

      {/* noValidate: the user sees the shared schema's messages, in their locale. */}
      <form action={formAction} className="mt-6 space-y-4" noValidate>
        <Input
          label={t("fields.displayName")}
          name="displayName"
          autoComplete="nickname"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldError("displayName")}
        />
        <Input
          label={t("fields.email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError("email")}
        />
        <Input
          label={t("fields.password")}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={fieldError("password")}
        />

        {state.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t(`errors.${state.error}`)}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("signup.pending") : t("signup.submit")}
        </Button>
      </form>

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        {t("signup.hasAccount")}{" "}
        <Link href="/login" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
          {t("signup.loginLink")}
        </Link>
      </p>
    </div>
  );
}
