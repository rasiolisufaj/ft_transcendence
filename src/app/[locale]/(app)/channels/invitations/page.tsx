import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getInvitationsChannel } from "../create/data";
import { acceptInvite, declineInvite } from "./action";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardDecor } from "@/components/dashboard/DashboardDecor";

export default async function InvitationsPage() {
  const t = await getTranslations("channels.invitations");
  const { user } = await requireUser();
  const invitationChannels = await getInvitationsChannel(user.email);
  const count = invitationChannels.length;

  return (
    <div className="relative">
      <DashboardDecor />
      <div className="relative z-10">
        <div className="mb-10 border-b border-border pb-8">
          <Link href="/channels" className="text-sm text-foreground-muted hover:text-foreground">
            {t("back")}
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            {count === 0 ? t("empty") : t("pending", { count })}
          </p>
          {count > 0 && <p className="mt-1 text-sm text-foreground-muted">{t("intro")}</p>}
        </div>

        {invitationChannels.length === 0 ? (
          <EmptyState title={t("empty")} description={t("intro")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {invitationChannels.map((invite) => (
              <Card key={invite.channelId} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-sm font-semibold text-primary-foreground">
                  {invite.channel.title.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground">{invite.channel.title}</h3>
                  {invite.channel.description ? (
                    <p className="line-clamp-2 text-sm text-foreground-muted">
                      {t("description", { description: invite.channel.description })}
                    </p>
                  ) : (
                    <p className="text-sm italic text-foreground-subtle">{t("noDescription")}</p>
                  )}
                  {invite.channel.members.length > 0 && (
                    <p className="mt-1 text-xs text-foreground-subtle">
                      {t("membersCount", { count: invite.channel.members.length })}
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <form action={acceptInvite}>
                      <input type="hidden" name="channelId" value={invite.channelId} />
                      <Button type="submit" variant="primary" className="px-3 py-1.5">
                        {t("accept")}
                      </Button>
                    </form>
                    <form action={declineInvite}>
                      <input type="hidden" name="channelId" value={invite.channelId} />
                      <Button type="submit" variant="secondary" className="px-3 py-1.5">
                        {t("decline")}
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
