export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { getChannelJoinRequests } from "./data";
import { acceptJoinRequest, rejectJoinRequest } from "./action";
import { getFormatter } from "next-intl/server";
export default async function ChannelRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const urlParams = await params;
  const idChannel = urlParams.id;
  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) {
    notFound();
  }

  const { user } = await requireUser();

  const userMember = await prisma.channelMember.findFirst({
    where: {
      userId: user.id,
      channelId: id,
    },
  });
  if (!userMember || userMember.role !== "MODERATOR") {
    notFound();
  }

  const requests = await getChannelJoinRequests(id);
  const format = await getFormatter();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href={`/channels/${id}`}
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← Back to the channel
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Join requests
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          People who want to join this private channel.
        </p>

        {requests.length === 0 ? (
          <p className="mt-6 text-sm italic text-zinc-400">
            You don't have any requests.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {requests.map((request) => (
              <div
                key={request.userId}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {request.user.displayName}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {format.dateTime(request.createdAt, {
                      dateStyle: "short",
                    })}{" "}
                  </p>
                </div>

                <div className="flex gap-2">
                  <form action={acceptJoinRequest}>
                    <input type="hidden" name="channelId" value={id} />
                    <input type="hidden" name="userId" value={request.userId} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                    >
                      Accept
                    </button>
                  </form>
                  <form action={rejectJoinRequest}>
                    <input type="hidden" name="channelId" value={id} />
                    <input type="hidden" name="userId" value={request.userId} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
