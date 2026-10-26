"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** "lg" for an immersive dialog (an onboarding tour); defaults to the compact size. */
  size?: "md" | "lg";
};

// Kept in step with the duration-200 classes below.
const CLOSE_MS = 200;

function closeDelay() {
  if (typeof window === "undefined") return CLOSE_MS;
  // prefers-reduced-motion already collapses the CSS transition to ~0 (globals.css);
  // this keeps the unmount timer in step with it instead of lingering invisibly.
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : CLOSE_MS;
}

export function Dialog({ open, onClose, title, children, size = "md" }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Stays mounted a beat after `open` goes false, so the exit transition can play.
  const [rendered, setRendered] = useState(open);
  // Flips one frame after mount (enter) or immediately on close (exit), driving
  // the CSS transition between the two — see the className below.
  const [entered, setEntered] = useState(false);
  // React's own pattern for reacting to a prop change during render rather
  // than in an effect (react.dev/learn/you-might-not-need-an-effect): opening
  // must mount immediately, closing must start the exit transition immediately.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRendered(true);
    else setEntered(false);
  }

  // Enter: one frame after mounting, flip to the visible state so the CSS
  // transition actually animates instead of starting already settled.
  useEffect(() => {
    if (!open || !rendered) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open, rendered]);

  // Exit: keep the dialog mounted long enough for the transition to play,
  // then actually remove it from the DOM.
  useEffect(() => {
    if (open || !rendered) return;
    const timeout = setTimeout(() => setRendered(false), closeDelay());
    return () => clearTimeout(timeout);
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered) return;

    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => opener?.focus();
  }, [rendered]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") keepFocusInside(e);
    }

    function keepFocusInside(e: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (!first || !last) {
        e.preventDefault(); // nothing to focus -> stay on the dialog itself
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

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${size === "lg" ? "max-w-2xl" : "max-w-md"} rounded-xl border border-border-strong bg-surface p-6 shadow-elevated outline-none transition duration-200 ease-out ${
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
