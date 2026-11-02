import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import ChannelForm from "./ChannelForm";

export default async function CreateChannelPage() {
  const t = await getTranslations("channels.create");
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{t("subtitle")}</p>

        <div className="mt-6">
          <ChannelForm />
        </div>
      </Card>
    </main>
  );
}
