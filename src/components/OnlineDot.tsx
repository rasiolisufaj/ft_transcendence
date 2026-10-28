"use client";

import { useTranslations } from "next-intl";
import { useOnlineFriends } from "./RealtimeProvider";

/**
 * A friend's presence, with a visible label (colour alone is not enough). `online` comes
 * from lastSeenAt when the page renders; with a `userId`, the realtime server's presence
 * takes over once it has said who is online (docs/plans/2026-10-19-d14-profile.md, "Live upgrade").
 */
export function OnlineDot({ online: seen, userId }: { online: boolean; userId?: string }) {
  const t = useTranslations("profile");
  const live = useOnlineFriends();
  const online = userId && live ? live.has(userId) : seen;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
      />
      {online ? t("online") : t("offline")}
    </span>
  );
}
