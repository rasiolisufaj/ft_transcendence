"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AuthPreviewSlot } from "@/components/auth/AuthPreviewSlot";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <div className="space-y-12">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        <Card className="mx-auto w-full max-w-sm lg:mx-0">
          <h1 className="text-2xl font-semibold text-foreground">{t("signup.title")}</h1>

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
              revealable
              showPasswordLabel={t("fields.passwordShow")}
              hidePasswordLabel={t("fields.passwordHide")}
              hint={t("fields.passwordHint")}
              error={fieldError("password")}
            />

            {state.error ? (
              <p role="alert" className="text-sm text-danger">
                {t(`errors.${state.error}`)}
              </p>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("signup.pending") : t("signup.submit")}
            </Button>
          </form>

          <p className="mt-6 text-sm text-foreground-muted">
            {t("signup.hasAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              {t("signup.loginLink")}
            </Link>
          </p>
        </Card>

        <AuthShowcase />
      </div>

      <AuthPreviewSlot />
    </div>
  );
}
