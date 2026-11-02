export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { OnlineDot } from "@/components/OnlineDot";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isOnline, isUserId, relationBetween } from "@/lib/users/profile";
import { AvatarForm } from "./AvatarForm";
import { ProfileForm } from "./ProfileForm";
import { addFriendFromProfile } from "./actions";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("profile");
  const format = await getFormatter();
  // The (app) layout is not a security boundary.
  const { user: viewer } = await requireUser();

  if (!isUserId(id)) notFound();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true,
      lastSeenAt: true,
      avatar: { select: { updatedAt: true } },
    },
  });
  if (!user) notFound();

  const isOwn = user.id === viewer.id;
  // A block, in either direction, answers exactly like a missing user (D15).
  const relation = isOwn ? null : await relationBetween(viewer.id, user.id);
  if (relation === "blocked") notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar
          name={user.displayName}
          size="lg"
          src={user.avatar ? `/api/users/${user.id}/avatar?v=${user.avatar.updatedAt.getTime()}` : null}
        />
        <div className="min-w-0 max-w-full space-y-1">
          <h1 className="truncate text-2xl font-semibold">{user.displayName}</h1>
          {relation === "friend" ? <OnlineDot online={isOnline(user.lastSeenAt)} userId={user.id} /> : null}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("memberSince", { date: format.dateTime(user.createdAt, { dateStyle: "long" }) })}
          </p>
          {/* The email is the login: only its owner sees it. */}
          {isOwn ? (
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
          ) : null}
          {/* A plain form: works without JavaScript, like the buttons on /friends. */}
          {relation === "none" ? (
            <form action={addFriendFromProfile} className="pt-2">
              <input type="hidden" name="userId" value={user.id} />
              <Button type="submit" className="px-3 py-1.5 text-xs">
                {t("addFriend")}
              </Button>
            </form>
          ) : relation === "pending" ? (
            <Link href="/friends" className="block pt-2 text-sm underline-offset-4 hover:underline">
              {t("friendPending")}
            </Link>
          ) : null}
        </div>
      </Card>
      {isOwn ? (
        <Card className="space-y-6">
          <h2 className="text-lg font-semibold">{t("edit.title")}</h2>
          <ProfileForm displayName={user.displayName} />
          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <AvatarForm />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
