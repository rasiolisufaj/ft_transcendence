import { HTMLAttributes } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
};

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

  const tones = {
    neutral: "border-border bg-surface-hover text-foreground-muted",
    primary: "border-primary-subtle bg-primary-subtle text-primary-subtle-foreground",
    success: "border-success-subtle bg-success-subtle text-success-subtle-foreground",
    warning: "border-warning-subtle bg-warning-subtle text-warning-subtle-foreground",
    danger: "border-danger-subtle bg-danger-subtle text-danger-subtle-foreground",
  };

  return <span className={`${base} ${tones[tone]} ${className}`} {...props} />;
}