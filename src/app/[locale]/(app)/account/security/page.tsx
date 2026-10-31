import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { SetupTotpForm } from "./SetupTotpForm";
import { DisableTotpForm } from "./DisableTotpForm";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const { user } = await requireUser();
  const t = await getTranslations("security");

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("intro")}</p>

        <section className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            {t("twoFactor.title")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t(user.totpEnabled ? "twoFactor.enabledDescription" : "twoFactor.disabledDescription")}
          </p>

          <div className="mt-4">
            {user.totpEnabled ? <DisableTotpForm /> : <SetupTotpForm />}
          </div>
        </section>
      </Card>
    </section>
  );
}
