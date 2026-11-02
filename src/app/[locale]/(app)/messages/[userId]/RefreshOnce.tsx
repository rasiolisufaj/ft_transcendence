"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

// The nav renders alongside the page, so the bell may have counted what the page just cleared.
export function RefreshOnce() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}
