"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

const primaryLink =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover";
const secondaryLink =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground-muted transition hover:border-border-strong hover:text-foreground";

// The assistant only ever answers from one document's content (CLAUDE.md: no
// cross-document context), so this just jumps to the most recently uploaded
// one, where its chat already lives — never a standalone general chat.
export function AssistantSection({ latestDocumentId }: { latestDocumentId: number | null }) {
  const t = useTranslations("dashboard.assistant");
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-10 rounded-2xl border border-border bg-surface-hover p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
            <ChatIcon />
          </span>
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">{t("title")}</h2>
            <p className="mt-1 max-w-md text-sm text-foreground-muted">{t("description")}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {latestDocumentId ? (
            <Link href={`/documents/view/${latestDocumentId}`} className={primaryLink}>
              {t("cta")}
            </Link>
          ) : (
            <Link href="/documents/new" className={secondaryLink}>
              {t("needsDocument")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("howItWorksCta")}
          </button>
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={t("dialogTitle")}>
        <ul className="list-disc space-y-3 pl-5 text-sm text-foreground-muted">
          <li>{t("dialogPoint1")}</li>
          <li>{t("dialogPoint2")}</li>
          <li>{t("dialogPoint3")}</li>
        </ul>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => setOpen(false)}>
            {t("close")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 10.5h7.5m-7.5 3h4.5m-7.5 6.75a9 9 0 1 1 7.5-4.03c-.14.2-.2.45-.17.69l.33 2.5a.75.75 0 0 1-1.02.8l-2.86-1.1a1.5 1.5 0 0 0-.75-.07c-.33.06-.68.09-1.03.09a9 9 0 0 1-2-.1"
      />
    </svg>
  );
}
