"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { uploadDocument } from "@/app/[locale]/(app)/documents/new/actions";

// Server-verified types only (documents/new/actions.ts checks pdf/png/jpeg magic
// bytes, not webp), so the file picker never offers a format the upload would reject.
const ACCEPT = "application/pdf,image/png,image/jpeg";

function SubmitBar() {
  const t = useTranslations("documentsNew");
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="mt-4 h-1 w-full rounded bg-border" role="progressbar" aria-label={t("uploading")}>
      <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
    </div>
  );
}

export function UploadDropzone() {
  const t = useTranslations("dashboard");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function submitFile(file: File) {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={uploadDocument}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file) submitFile(file);
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
          dragActive ? "border-primary bg-primary-subtle" : "border-border-strong bg-surface-hover"
        }`}
      >
        <UploadIcon className="mb-4 size-10 text-foreground-subtle" />
        <p className="mb-4 text-sm text-foreground-muted">
          {dragActive ? t("importZone.dropHere") : t("empty")}
        </p>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shadow-elevated"
        >
          {t("importZone.cta")}
        </Button>
        <p className="mt-4 text-xs text-foreground-subtle">{t("importZone.hint")}</p>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) submitFile(file);
          }}
          className="sr-only"
        />
      </div>
      <SubmitBar />
    </form>
  );
}

function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}
