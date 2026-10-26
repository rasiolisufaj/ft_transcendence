import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { kickMembers, setChannelRole } from "./action";

export default async function kickUser({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.kick");
  const promise = await params;
  const idChannel = promise.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }
  const ctx = await requireUser();
  // The same check as kickMembers: a moderator of this channel, or an admin.
  if (!can(ctx, "channel:moderate", { channelId: id })) notFound();
  // The same check as setChannelRole: admins only (§C-18).
  const canManageRoles = can(ctx, "channel:manageRoles", { channelId: id });

  const channel = await prisma.channel.findFirst({
    where: {
      id: id,
    },
    include: {
      members: {
        // A fixed order: Postgres returns an updated row last, so without it a role
        // change moves the rows under the admin's cursor. userId breaks joinedAt ties.
        orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });
  if (!channel) return;

  const member = channel.members;
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link href="/channels" className="text-sm text-foreground-muted hover:text-foreground">
        {t("back")}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">{channel.title}</h1>
      {channel.description && (
        <p className="mt-1 text-sm text-foreground-muted">{channel.description}</p>
      )}
      <p className="mt-2 text-xs text-foreground-subtle">
        {t("membersCount", { count: member.length })}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {member.map((membre) => (
          <Card key={membre.userId} className="flex items-start justify-between gap-4 p-4">
            <form
              action={kickMembers}
              className="flex w-full items-center justify-between gap-4"
            >
              <input type="hidden" name="channelId" value={channel.id} />
              <input type="hidden" name="userId" value={membre.userId} />
              {/* Read by setChannelRole only. Not on the button: React overrides the name of a
                  button whose formAction is a function, to encode which action to invoke. */}
              <input type="hidden" name="role" value={membre.role === "MODERATOR" ? "MEMBER" : "MODERATOR"} />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium text-foreground">
                  {membre.user.displayName}
                </h1>
                <div className="mt-1">
                  <Badge tone={membre.role === "MODERATOR" ? "primary" : "neutral"}>
                    {membre.role === "MODERATOR" ? t("moderator") : t("member")}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {/* Same form, other action. */}
                {canManageRoles && (
                  <button
                    type="submit"
                    formAction={setChannelRole}
                    className="rounded-lg px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                  >
                    {membre.role === "MODERATOR" ? t("demote") : t("promote")}
                  </button>
                )}
                {/* kickMembers refuses yourself and moderators: no button that does nothing */}
                {membre.role === "MEMBER" && membre.userId !== ctx.user.id && (
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger-subtle"
                  >
                    {t("kick")}
                  </button>
                )}
              </div>
            </form>
          </Card>
        ))}
      </div>
    </main>
  );
}
