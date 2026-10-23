import { useTranslations } from "next-intl";

/**
 * A friend's presence, with a visible label (colour alone is not enough). Today `online`
 * comes from lastSeenAt when the page renders. When realtime ships, this becomes a client
 * component that starts from `online` and follows presence.changed events
 * (docs/plans/2026-10-19-d14-profile.md, "Live upgrade").
 */
export function OnlineDot({ online }: { online: boolean }) {
  const t = useTranslations("profile");
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
