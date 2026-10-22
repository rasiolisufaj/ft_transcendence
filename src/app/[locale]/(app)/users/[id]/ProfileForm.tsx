"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ProfileFormState } from "@/lib/users/schemas";
import { updateProfile } from "./actions";

const initialState: ProfileFormState = {};

export function ProfileForm({ displayName }: { displayName: string }) {
  const t = useTranslations("profile");
  const tAuth = useTranslations("auth");
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  // Controlled: React resets uncontrolled fields after every action.
  const [name, setName] = useState(displayName);
  // After a save, refresh() brings the stored (trimmed) name: show it in the field too.
  const [shown, setShown] = useState(displayName);
  if (shown !== displayName) {
    setShown(displayName);
    setName(displayName);
  }
  const errorKey = state.fieldErrors?.displayName?.[0];

  return (
    // noValidate: the user sees the shared schema's messages, in their locale.
    <form action={formAction} className="space-y-4" noValidate>
      <Input
        label={t("edit.displayName")}
        name="displayName"
        autoComplete="nickname"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errorKey && tAuth(`errors.${errorKey}`)}
      />
      {state.saved ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {t("edit.saved")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("edit.pending") : t("edit.submit")}
      </Button>
    </form>
  );
}
