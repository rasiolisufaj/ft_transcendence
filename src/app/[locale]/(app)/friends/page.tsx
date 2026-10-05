export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/session";
import { listFriendships } from "@/lib/friends/friendships";
import { AddFriendForm } from "./AddFriendForm";
import { FriendsTabs } from "./FriendsTabs";
import {
  acceptFriend,
  blockUser,
  cancelFriendRequest,
  declineFriend,
  removeFriendAction,
  unblockUser,
} from "./actions";

type Person = { id: string; displayName: string };
type Run = (formData: FormData) => Promise<void>;

const linkStyle =
  "text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";
const dangerStyle =
  "text-sm text-red-600 underline-offset-4 hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300";

export default async function FriendsPage() {
  const t = await getTranslations("friends");
  // The (app) layout is not a security boundary.
  const { user } = await requireUser();
  const { friends, incoming, outgoing, blocked } = await listFriendships(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
      </div>

      <AddFriendForm />

      {/* The only thing that needs an answer: shown first, and only when there is one. */}
      {incoming.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
            {t("sections.incoming")}
            <span className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400">{incoming.length}</span>
          </h2>
          <PeopleList people={incoming}>
            {(person) => (
              <>
                <ActionButton run={acceptFriend} person={person} primary>
                  {t("actions.accept")}
                </ActionButton>
                <ActionButton run={declineFriend} person={person}>
                  {t("actions.decline")}
                </ActionButton>
              </>
            )}
          </PeopleList>
        </section>
      ) : null}

      <FriendsTabs
        label={t("tabs.label")}
        tabs={[
          {
            key: "friends",
            label: t("tabs.friends"),
            count: friends.length,
            panel: (
              <PeopleList people={friends} empty={t("empty.friends")}>
                {(person) => (
                  <>
                    <ActionButton run={removeFriendAction} person={person}>
                      {t("actions.remove")}
                    </ActionButton>
                    <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                      ·
                    </span>
                    <ActionButton run={blockUser} person={person} danger>
                      {t("actions.block")}
                    </ActionButton>
                  </>
                )}
              </PeopleList>
            ),
          },
          {
            key: "outgoing",
            label: t("tabs.outgoing"),
            count: outgoing.length,
            panel: (
              <PeopleList people={outgoing} empty={t("empty.outgoing")}>
                {(person) => (
                  <ActionButton run={cancelFriendRequest} person={person}>
                    {t("actions.cancel")}
                  </ActionButton>
                )}
              </PeopleList>
            ),
          },
          {
            key: "blocked",
            label: t("tabs.blocked"),
            count: blocked.length,
            panel: (
              <PeopleList people={blocked} empty={t("empty.blocked")}>
                {(person) => (
                  <ActionButton run={unblockUser} person={person}>
                    {t("actions.unblock")}
                  </ActionButton>
                )}
              </PeopleList>
            ),
          },
        ]}
      />
    </div>
  );
}

function PeopleList({
  people,
  empty,
  children,
}: {
  people: Person[];
  empty?: string;
  children: (person: Person) => ReactNode;
}) {
  if (people.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {people.map((person) => (
        <li key={person.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <span className="min-w-0 truncate text-sm font-medium">{person.displayName}</span>
          <div className="flex items-center gap-3">{children(person)}</div>
        </li>
      ))}
    </ul>
  );
}

// A hidden userId and a Server Action: works without JavaScript.
function ActionButton({
  run,
  person,
  primary = false,
  danger = false,
  children,
}: {
  run: Run;
  person: Person;
  primary?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <form action={run}>
      <input type="hidden" name="userId" value={person.id} />
      {primary ? (
        <Button type="submit" className="px-3 py-1.5 text-xs">
          {children}
        </Button>
      ) : (
        <button type="submit" className={danger ? dangerStyle : linkStyle}>
          {children}
        </button>
      )}
    </form>
  );
}
