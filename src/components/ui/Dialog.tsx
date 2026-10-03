"use client";

import { ReactNode, useEffect, useRef } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog on open, and back to whatever opened it on close,
  // so a keyboard user does not land at the top of the page.
  // Only depends on `open`: a new onClose on each parent render must not move focus.
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => opener?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") keepFocusInside(e);
    }

    // aria-modal: Tab and Shift+Tab loop inside the dialog instead of reaching
    // the page hidden behind the overlay.
    function keepFocusInside(e: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (!first || !last) {
        e.preventDefault(); // nothing to focus: stay on the dialog itself
        return;
      }

      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border-2 border-zinc-300 bg-white p-6 shadow-lg outline-none dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="mb-4 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}