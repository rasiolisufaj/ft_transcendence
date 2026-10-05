export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { listFriendships } from "@/lib/friends/friendships";
import { AddFriendForm } from "./AddFriendForm";
import {
  acceptFriend,
  blockUser,
  cancelFriendRequest,
  declineFriend,
  removeFriendAction,
  unblockUser,
} from "./actions";

type Person = { id: string; displayName: string };

export default async function FriendsPage() {
  const t = await getTranslations("friends");
  // The (app) layout is not a security boundary.
  const { user } = await requireUser();
  const { friends, incoming, outgoing, blocked } = await listFriendships(user.id);

  function action(run: (formData: FormData) => Promise<void>, label: string, person: Person, secondary = false) {
    return (
      <form action={run}>
        <input type="hidden" name="userId" value={person.id} />
        <Button type="submit" variant={secondary ? "secondary" : "primary"} className="px-3 py-1 text-xs">
          {label}
        </Button>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
      </div>

      <Card>
        <AddFriendForm />
      </Card>

      <Section title={t("sections.incoming")} empty={t("empty.incoming")} people={incoming}>
        {(person) => (
          <>
            {action(acceptFriend, t("actions.accept"), person)}
            {action(declineFriend, t("actions.decline"), person, true)}
          </>
        )}
      </Section>

      <Section title={t("sections.friends")} empty={t("empty.friends")} people={friends}>
        {(person) => (
          <>
            {action(removeFriendAction, t("actions.remove"), person, true)}
            {action(blockUser, t("actions.block"), person, true)}
          </>
        )}
      </Section>

      <Section title={t("sections.outgoing")} empty={t("empty.outgoing")} people={outgoing}>
        {(person) => action(cancelFriendRequest, t("actions.cancel"), person, true)}
      </Section>

      <Section title={t("sections.blocked")} empty={t("empty.blocked")} people={blocked}>
        {(person) => action(unblockUser, t("actions.unblock"), person, true)}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  people,
  children,
}: {
  title: string;
  empty: string;
  people: Person[];
  children: (person: Person) => ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        {title} ({people.length})
      </h2>
      {people.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {people.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate font-medium">{person.displayName}</span>
              <div className="flex gap-2">{children(person)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
