import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { editChannel } from "./action";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policy";

const fieldClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary";

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("channels.edit");
  const promise = await params;
  const idChannel = promise.id;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }

  const ctx = await requireUser();
  // The same check as editChannel.
  if (!can(ctx, "channel:update", { channelId: id })) notFound();

  const channel = await prisma.channel.findFirst({
    where: { id: id },
    select: {
      id: true,
      title: true,
      description: true,
      threads: {
        select: { id: true, content: true },
      },
    },
  });

  if (!channel) {
    notFound();
  }
  const question = channel.threads[0];
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{t("subtitle")}</p>

        <form className="mt-6 flex flex-col gap-4" action={editChannel}>
          <input type="hidden" name="channelId" value={channel.id} />
          <input type="hidden" name="questionId" value={question?.id ?? ""} />

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              {t("nameLabel")}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={99}
              defaultValue={channel.title}
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              {t("descriptionLabel")}
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={250}
              defaultValue={channel.description ?? ""}
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="question" className="text-sm font-medium text-foreground">
              {t("questionLabel")}
            </label>
            <textarea
              id="question"
              name="question"
              rows={4}
              required
              maxLength={300}
              defaultValue={question?.content}
              className={fieldClass}
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Link
              href="/channels"
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
