"use client";

import { InputHTMLAttributes, forwardRef, useId, useState } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Adds a show/hide toggle. Only takes effect when type="password". */
  revealable?: boolean;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      revealable = false,
      showPasswordLabel = "Show password",
      hidePasswordLabel = "Hide password",
      className = "",
      id,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [revealed, setRevealed] = useState(false);
    const canReveal = revealable && type === "password";
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={canReveal && revealed ? "text" : type}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-40 ${
              error ? "border-danger focus:ring-danger" : "border-border-strong"
            } ${canReveal ? "pe-10" : ""} ${className}`}
            {...props}
          />
          {canReveal && (
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? hidePasswordLabel : showPasswordLabel}
              aria-pressed={revealed}
              className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-foreground-subtle transition hover:text-foreground-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-foreground-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.065 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}
