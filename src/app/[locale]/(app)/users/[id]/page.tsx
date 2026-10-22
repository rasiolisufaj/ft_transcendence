export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isUserId, relationBetween } from "@/lib/users/profile";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("profile");
  const format = await getFormatter();
  // The (app) layout is not a security boundary.
  const { user: viewer } = await requireUser();

  if (!isUserId(id)) notFound();
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, displayName: true, email: true, createdAt: true },
  });
  if (!user) notFound();

  const isOwn = user.id === viewer.id;
  // A block, in either direction, answers exactly like a missing user (D15).
  const relation = isOwn ? null : await relationBetween(viewer.id, user.id);
  if (relation === "blocked") notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar name={user.displayName} size="lg" />
        <div className="min-w-0 max-w-full space-y-1">
          <h1 className="truncate text-2xl font-semibold">{user.displayName}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("memberSince", { date: format.dateTime(user.createdAt, { dateStyle: "long" }) })}
          </p>
          {/* The email is the login: only its owner sees it. */}
          {isOwn ? (
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
