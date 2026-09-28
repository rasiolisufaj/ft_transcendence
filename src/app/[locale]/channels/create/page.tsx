import { getTranslations } from "next-intl/server";
import ChannelForm from "./ChannelForm";

export default async function CreateChannelPage() {
  const t = await getTranslations("channels.create");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("subtitle")}
        </p>

        <div className="mt-6">
          <ChannelForm />
        </div>
      </div>
    </main>
  );
}
