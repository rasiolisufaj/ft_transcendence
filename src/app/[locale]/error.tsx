"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors.generic");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title={t("title")}
      description={t("description")}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => retry()}>{t("retry")}</Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-transparent px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
          >
            {t("backHome")}
          </Link>
        </div>
      }
    />
  );
}
