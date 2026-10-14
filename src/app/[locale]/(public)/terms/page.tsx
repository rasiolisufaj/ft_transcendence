export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";

const h1 = "text-3xl font-bold tracking-tight";
const h2 = "mt-10 text-xl font-semibold";
const p = "mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400";
const lead = "mt-2 text-sm text-zinc-500 dark:text-zinc-400";

export default async function TermsPage() {
  const t = await getTranslations("terms");

  return (
    <article className="mx-auto max-w-3xl pb-12">
      <h1 className={h1}>{t("title")}</h1>
      <p className={lead}>{t("lastUpdated")}</p>

      <h2 className={h2}>{t("acceptance.heading")}</h2>
      <p className={p}>{t("acceptance.body")}</p>

      <h2 className={h2}>{t("service.heading")}</h2>
      <p className={p}>{t("service.body")}</p>
      <ul className={ul}>
        <li>{t("service.items.vault")}</li>
        <li>{t("service.items.ai")}</li>
        <li>{t("service.items.community")}</li>
      </ul>

      <h2 className={h2}>{t("accounts.heading")}</h2>
      <p className={p}>{t("accounts.body")}</p>
      <ul className={ul}>
        <li>{t("accounts.items.accuracy")}</li>
        <li>{t("accounts.items.security")}</li>
        <li>{t("accounts.items.onePerPerson")}</li>
      </ul>

      <h2 className={h2}>{t("documents.heading")}</h2>
      <p className={p}>{t("documents.body")}</p>

      <h2 className={h2}>{t("ai.heading")}</h2>
      <p className={p}>{t("ai.body")}</p>

      <h2 className={h2}>{t("community.heading")}</h2>
      <p className={p}>{t("community.body")}</p>
      <ul className={ul}>
        <li>{t("community.items.respectful")}</li>
        <li>{t("community.items.noSpam")}</li>
        <li>{t("community.items.noIllegal")}</li>
        <li>{t("community.items.noPersonalData")}</li>
      </ul>
      <p className={p}>{t("community.moderation")}</p>

      <h2 className={h2}>{t("intellectualProperty.heading")}</h2>
      <p className={p}>{t("intellectualProperty.body")}</p>

      <h2 className={h2}>{t("liability.heading")}</h2>
      <p className={p}>{t("liability.body")}</p>

      <h2 className={h2}>{t("termination.heading")}</h2>
      <p className={p}>{t("termination.body")}</p>

      <h2 className={h2}>{t("modifications.heading")}</h2>
      <p className={p}>{t("modifications.body")}</p>

      <h2 className={h2}>{t("law.heading")}</h2>
      <p className={p}>{t("law.body")}</p>

      <h2 className={h2}>{t("contact.heading")}</h2>
      <p className={p}>{t("contact.body")}</p>
    </article>
  );
}
