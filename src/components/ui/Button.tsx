import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover",
    secondary:
      "border-border bg-transparent text-foreground-muted hover:border-border-strong hover:text-foreground",
    danger:
      "border-danger-subtle bg-danger-subtle text-danger-subtle-foreground hover:border-danger",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}