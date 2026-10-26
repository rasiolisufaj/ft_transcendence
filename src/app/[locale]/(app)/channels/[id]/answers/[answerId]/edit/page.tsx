import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { modifAnswerUser } from "../../../actions";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";

export default async function EditAnswerPage({
  params,
}: {
  params: Promise<{ id: string; answerId: string }>;
}) {
  const t = await getTranslations("channels.answerEdit");
  const promise = await params;
  const idChannel = promise.id;
  const answerId = promise.answerId;

  if (
    typeof idChannel !== "string" ||
    typeof answerId !== "string" ||
    !idChannel ||
    !answerId
  )
    return;

  const trueIdChannel: number = parseInt(idChannel, 10);
  const trueAnswerId: number = parseInt(answerId, 10);

  if (
    Number.isNaN(trueAnswerId) ||
    Number.isNaN(trueIdChannel) ||
    trueAnswerId <= 0 ||
    trueIdChannel <= 0
  )
    return;

  const ctx = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: { id: trueIdChannel },
  });
  if (!channel) {
    return;
  }

  const answer = await prisma.answer.findFirst({
    where: { id: trueAnswerId },
  });

  // The same check as modifAnswerUser.
  if (!answer || !can(ctx, "answer:update", { ownerUserId: answer.userId })) {
    return;
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>

        <form className="mt-6 flex flex-col gap-3" action={modifAnswerUser}>
          <input type="hidden" name="answerId" value={answer.id} />
          <input type="hidden" name="channelId" value={trueIdChannel} />
          <textarea
            name="content"
            defaultValue={answer.content}
            required
            maxLength={1000}
            rows={5}
            className="rounded-lg border border-border-strong bg-surface p-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary"
          />

          <div className="flex justify-end gap-2">
            <Link
              href={`/channels/${channel.id}`}
              className="rounded-lg px-4 py-2 text-sm text-foreground-muted hover:bg-surface-hover"
            >
              {t("cancel")}
            </Link>
            <Button type="submit">{t("save")}</Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
