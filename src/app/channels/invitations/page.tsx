import Link from "next/link";
import { getInvitationsChannel } from "@/app/channels/create/data";
import { channel } from "diagnostics_channel";
import { acceptInvite, declineInvite } from "./action";

export default async function InvitationsPage()
{
    const invitationChannels = await getInvitationsChannel("Amir@gmail.com");
    const count = invitationChannels.length;

    return (
        <main className="mx-auto max-w-xl px-4 py-16">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <Link
                    href="/channels"
                    className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
                >
                    ← Retour aux channels
                </Link>

                <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Mes invitations
                </h1>

                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {count === 0
                        ? "Tu n'as aucune invitation pour le moment."
                        : `Tu as ${count} invitation${count > 1 ? "s" : ""} en attente.`}
                </p>

                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                    Un modérateur t'a invité à rejoindre son channel.
                    Accepte pour devenir membre, ou refuse pour supprimer l'invitation.
                </p>

                <div className="mt-6 flex flex-col gap-3">

                </div>
            </div>
            {invitationChannels.length > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                    {invitationChannels.map((invite) => (
                        <div key={invite.channelId} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{invite.channel.title}</h3>
                            {invite.channel.description && (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">description : {invite.channel.description}</p>
                            )}
                            {!invite.channel.title && (
                                <p className="text-sm italic text-zinc-400"> ce channel na pas de description </p>
                            )}
                            {invite.channel.members.length > 0 && (
                                <p className="mt-1 text-xs text-zinc-400"> le nombres de user du channel est {invite.channel.members.length}</p>
                            )}
<div className="mt-3 flex gap-2">
    <form action={acceptInvite}>
        <input type="hidden" name="channelId" value={invite.channelId} />
        <button
            type="submit"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
        >
            Accepter
        </button>
    </form>
    <form action={declineInvite}>
        <input type="hidden" name="channelId" value={invite.channelId} />
        <button
            type="submit"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
            Refuser
        </button>
    </form>
</div>
                           
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}