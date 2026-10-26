"use client";

import { useTranslations } from "next-intl";

/**
 * The marketing panel next to the login/signup form. Full version from `lg`
 * (steps + pillars + trust line); a short version below the form on narrower
 * screens (headline + pillars only) — same translation keys, less of them shown.
 */
export function AuthShowcase() {
  const t = useTranslations("auth.showcase");

  const steps = [
    { icon: <CameraIcon />, title: t("steps.step1.title"), description: t("steps.step1.description") },
    { icon: <CalendarIcon />, title: t("steps.step2.title"), description: t("steps.step2.description") },
    { icon: <BellIcon />, title: t("steps.step3.title"), description: t("steps.step3.description") },
  ];

  const pillars = [
    { icon: <LockIcon />, title: t("pillars.vault.title"), description: t("pillars.vault.description") },
    { icon: <ChatIcon />, title: t("pillars.assistant.title"), description: t("pillars.assistant.description") },
    { icon: <UsersIcon />, title: t("pillars.community.title"), description: t("pillars.community.description") },
  ];

  return (
    <aside aria-label={t("eyebrow")}>
      {/* Full panel: lg and up. */}
      <div className="hidden lg:flex lg:h-full lg:flex-col lg:justify-center lg:gap-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {t("headline")}
          </h2>
          <p className="mt-3 text-foreground-muted">{t("subhead")}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground-muted">{t("stepsTitle")}</h3>
          <ol className="mt-4 space-y-4">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
                  {step.icon}
                </span>
                <div>
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-foreground-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <ul className="grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          {pillars.map((pillar, index) => (
            <li key={index}>
              <span className="text-foreground-subtle">{pillar.icon}</span>
              <p className="mt-2 font-medium text-foreground">{pillar.title}</p>
              <p className="mt-1 text-sm text-foreground-muted">{pillar.description}</p>
            </li>
          ))}
        </ul>

        <p className="flex items-center gap-2 text-sm text-foreground-muted">
          <LockIcon />
          {t("trust")}
        </p>
      </div>

      {/* Short version: below the form on narrower screens. */}
      <div className="mt-10 lg:hidden">
        <h2 className="text-lg font-semibold text-foreground">{t("headline")}</h2>
        <p className="mt-1 text-sm text-foreground-muted">{t("subhead")}</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {pillars.map((pillar, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="text-foreground-subtle">{pillar.icon}</span>
              <p className="text-sm font-medium text-foreground">{pillar.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 0 1 8.98 4.5h6.04a2.31 2.31 0 0 1 2.153 1.675l.527 1.325h1.275a2.25 2.25 0 0 1 2.25 2.25v8.25a2.25 2.25 0 0 1-2.25 2.25H5.025a2.25 2.25 0 0 1-2.25-2.25V9.75a2.25 2.25 0 0 1 2.25-2.25H6.3l.527-1.325Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3.75 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h12a2.25 2.25 0 0 1 2.25 2.25v11.25m-16.5 0A2.25 2.25 0 0 0 6 21h12a2.25 2.25 0 0 0 2.25-2.25m-16.5 0V11.25a2.25 2.25 0 0 1 2.25-2.25h12a2.25 2.25 0 0 1 2.25 2.25v7.5M12 15h.008v.008H12V15Z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
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

function ChatIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  );
}
