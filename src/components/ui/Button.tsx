import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "border-zinc-900 bg-zinc-900 text-white hover:border-zinc-700 hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:border-zinc-300 dark:hover:bg-zinc-300",
    secondary:
      "border-zinc-200 bg-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}