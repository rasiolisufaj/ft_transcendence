import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { deleteChannel } from "./action";

export default async function DeleteChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.delete");
  const promise = await params;
  const idChannel = promise.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }
  const ctx = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: { id: id },
    include: { _count: { select: { members: true } } },
  });
  // The same check as deleteChannel: the creator while they still moderate it, or an admin.
  if (!channel || !can(ctx, "channel:delete", { channelId: id, ownerUserId: channel.createdBy })) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link href="/channels" className="text-sm text-foreground-muted hover:text-foreground">
        {t("back")}
      </Link>

      <Card className="mt-4 border-danger-subtle">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("title", { channel: channel.title })}
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {t("warning", { count: channel._count.members })}
        </p>
        <p className="mt-4 rounded-lg bg-danger-subtle p-3 text-sm font-medium text-danger-subtle-foreground">
          {t("reminder")}
        </p>

        <form action={deleteChannel} className="mt-6 flex gap-3">
          <input type="hidden" name="deletechannel" value={channel.id} />
          <Link
            href="/channels"
            className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm text-foreground-muted transition hover:border-border-strong hover:text-foreground"
          >
            {t("cancel")}
          </Link>
          <Button type="submit" variant="danger" className="flex-1">
            {t("submit")}
          </Button>
        </form>
      </Card>
    </main>
  );
}
