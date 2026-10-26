import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getAllUsers } from "../../create/data";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inviteUser } from "./action";
import { requireUser } from "@/lib/auth/session";

// revoir les commentaires plus tard
export default async function InviteUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.invite");
  // recupere
  const promise = await params;
  const idChannel = promise.id;
  const trueIdChannel = parseInt(idChannel, 10);

  if (
    Number.isNaN(trueIdChannel) ||
    trueIdChannel <= 0 ||
    String(trueIdChannel) !== idChannel
  ) {
    return;
  }
  const ctx = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: { id: trueIdChannel },
  });

  if (!channel) return;
  // The same check as inviteUser.
  if (!can(ctx, "channel:moderate", { channelId: channel.id })) notFound();
  const users = await getAllUsers();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link href="/channels" className="text-sm text-foreground-muted hover:text-foreground">
        {t("back")}
      </Link>

      <Card className="mt-4">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("title", { channel: channel.title })}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{t("subtitle")}</p>

        <form className="mt-6 flex flex-col gap-3" action={inviteUser}>
          <input type="hidden" name="channelId" value={channel.id} />

          <select
            name="userId"
            required
            defaultValue=""
            aria-label={t("userAria")}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>
              {t("chooseUser")}
            </option>
            {users.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName} ({person.email})
              </option>
            ))}
          </select>

          <Button type="submit">{t("submit")}</Button>
        </form>
      </Card>
    </main>
  );
}
