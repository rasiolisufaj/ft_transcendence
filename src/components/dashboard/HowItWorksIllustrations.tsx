import { ReactNode } from "react";

// A plain phone silhouette, deliberately not a fake iOS status bar (craft
// rule: no "9:41 / battery / wifi" chrome) — just a bezel and a speaker pill,
// enough to read as "a phone" without pretending to be a real screenshot.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-40 w-24 shrink-0 flex-col items-center rounded-[1.5rem] border-[3px] border-border-strong bg-surface p-1.5 shadow-card"
    >
      <span className="mb-1 h-1 w-6 shrink-0 rounded-full bg-border-strong" />
      <div className="flex w-full flex-1 items-center justify-center rounded-2xl bg-surface-hover">
        {children}
      </div>
    </div>
  );
}

export function UploadIllustration() {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
        <UploadArrowIcon />
      </span>
      <div className="flex flex-col items-center gap-1">
        <span className="h-1 w-10 rounded-full bg-border-strong" />
        <span className="h-1 w-6 rounded-full bg-border" />
      </div>
    </div>
  );
}

export function ClassifyIllustration() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 text-foreground-subtle">
        <DocumentIcon />
        <ArrowRightIcon />
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <SparkleIcon small />
        </span>
      </div>
      <div className="flex gap-1">
        <span className="size-1.5 rounded-full bg-primary" />
        <span className="size-1.5 rounded-full bg-border-strong" />
        <span className="size-1.5 rounded-full bg-border-strong" />
      </div>
    </div>
  );
}

export function ChatIllustration() {
  return (
    <div className="flex w-full flex-col gap-1.5 px-2">
      <div className="ml-auto max-w-[80%] rounded-xl rounded-br-md bg-primary px-2 py-1.5">
        <span className="block h-1 w-9 rounded-full bg-primary-foreground/70" />
      </div>
      <div className="flex items-end gap-1">
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
          <SparkleIcon small />
        </span>
        <div className="max-w-[80%] rounded-xl rounded-bl-md border border-border bg-surface px-2 py-1.5">
          <span className="mb-0.5 block h-1 w-10 rounded-full bg-border-strong" />
          <span className="block h-1 w-6 rounded-full bg-border" />
        </div>
      </div>
    </div>
  );
}

function UploadArrowIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h3m-6.75 5.25h10.5a2.25 2.25 0 0 0 2.25-2.25V7.5L13.5 3H6.75A2.25 2.25 0 0 0 4.5 5.25v13.5a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
    </svg>
  );
}

function SparkleIcon({ small = false }: { small?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={small ? "size-3" : "size-5"}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.5c.3 3.2 1.6 5.4 4.8 5.8-3.2.4-4.5 2.6-4.8 5.8-.3-3.2-1.6-5.4-4.8-5.8 3.2-.4 4.5-2.6 4.8-5.8ZM19 13.5c.17 1.8.9 3 2.5 3.2-1.6.2-2.33 1.4-2.5 3.2-.17-1.8-.9-3-2.5-3.2 1.6-.2 2.33-1.4 2.5-3.2Z" />
    </svg>
  );
}
