"use client";

import { useTranslations } from "next-intl";

/**
 * The text panel next to the login/signup form: eyebrow, headline, subhead,
 * trust line. The demo preview is a separate, full-width block the page
 * renders below this grid (`AuthPreviewSlot`, not passed in here) — kept
 * clear and undimmed, not blended behind text or the form.
 */
export function AuthShowcase() {
  const t = useTranslations("auth.showcase");

  return (
    <aside aria-label={t("eyebrow")} className="lg:pt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {t("eyebrow")}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {t("headline")}
      </h2>
      <p className="mt-3 text-foreground-muted">{t("subhead")}</p>
      <p className="mt-6 flex items-center gap-2 text-sm text-foreground-muted">
        <LockIcon />
        {t("trust")}
      </p>
    </aside>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}
