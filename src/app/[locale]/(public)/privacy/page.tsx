export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";

const h1 = "text-3xl font-bold tracking-tight";
const h2 = "mt-10 text-xl font-semibold";
const h3 = "mt-6 text-base font-semibold";
const p = "mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400";
const lead = "mt-2 text-sm text-zinc-500 dark:text-zinc-400";

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <article className="mx-auto max-w-3xl pb-12">
      <h1 className={h1}>{t("title")}</h1>
      <p className={lead}>{t("lastUpdated")}</p>

      <h2 className={h2}>{t("intro.heading")}</h2>
      <p className={p}>{t("intro.body")}</p>

      <h2 className={h2}>{t("dataCollected.heading")}</h2>
      <h3 className={h3}>{t("dataCollected.account.heading")}</h3>
      <p className={p}>{t("dataCollected.account.body")}</p>
      <h3 className={h3}>{t("dataCollected.documents.heading")}</h3>
      <p className={p}>{t("dataCollected.documents.body")}</p>
      <h3 className={h3}>{t("dataCollected.community.heading")}</h3>
      <p className={p}>{t("dataCollected.community.body")}</p>

      <h2 className={h2}>{t("aiProcessing.heading")}</h2>
      <p className={p}>{t("aiProcessing.body")}</p>
      <ul className={ul}>
        <li>{t("aiProcessing.items.classification")}</li>
        <li>{t("aiProcessing.items.assistant")}</li>
      </ul>
      <p className={p}>{t("aiProcessing.noTraining")}</p>

      <h2 className={h2}>{t("retention.heading")}</h2>
      <p className={p}>{t("retention.body")}</p>
      <ul className={ul}>
        <li>{t("retention.items.account")}</li>
        <li>{t("retention.items.documents")}</li>
        <li>{t("retention.items.community")}</li>
        <li>{t("retention.items.sessions")}</li>
      </ul>

      <h2 className={h2}>{t("sharing.heading")}</h2>
      <p className={p}>{t("sharing.body")}</p>

      <h2 className={h2}>{t("rights.heading")}</h2>
      <p className={p}>{t("rights.body")}</p>
      <ul className={ul}>
        <li>{t("rights.items.access")}</li>
        <li>{t("rights.items.rectification")}</li>
        <li>{t("rights.items.deletion")}</li>
        <li>{t("rights.items.export")}</li>
        <li>{t("rights.items.objection")}</li>
      </ul>
      <p className={p}>{t("rights.howTo")}</p>

      <h2 className={h2}>{t("cookies.heading")}</h2>
      <p className={p}>{t("cookies.body")}</p>

      <h2 className={h2}>{t("contact.heading")}</h2>
      <p className={p}>{t("contact.body")}</p>
    </article>
  );
}
