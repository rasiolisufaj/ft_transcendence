import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { int } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { modifAnswerUser } from "../../../actions";
import { requireUser } from "@/lib/auth/session";

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

  const { user } = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: { id: trueIdChannel },
  });
  if (!channel) {
    return;
  }

  const member = await prisma.channelMember.findFirst({
    where: { channelId: channel.id, userId: user.id },
  });
  if (!member) {
    return;
  }

  const answer = await prisma.answer.findFirst({
    where: { id: trueAnswerId },
  });

  if (!answer || answer.userId !== user.id) {
    return;
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">{t("title")}</h1>

      <form className="flex flex-col gap-3" action={modifAnswerUser}>
        <input type="hidden" name="answerId" value={answer.id} />
        <input type="hidden" name="channelId" value={trueIdChannel} />
        <textarea
          name="content"
          defaultValue={answer.content}
          required
          maxLength={1000}
          rows={5}
          className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <div className="flex justify-end gap-2">
          <Link
            href={`/channels/${channel.id}`}
            className="rounded-lg px-4 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {t("save")}
          </button>
        </div>
      </form>
    </main>
  );
}
