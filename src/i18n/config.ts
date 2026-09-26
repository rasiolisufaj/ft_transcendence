/**
 * Les locales de l'application.
 *
 * PROJECT_PLAN §0 : « Locales: `fr` (default), `en`, `es` ». §5 désigne ce
 * fichier comme l'endroit d'où `Locale` est exporté.
 *
 * Ce fichier appartient à D10 (Alexandre). Il ne contient ici que ce dont le
 * routage a besoin — `next-intl`, les catalogues de messages et le sélecteur de
 * langue restent à écrire dans D10/D11. Le segment `[locale]` est posé dès
 * maintenant pour qu'aucune route n'ait à bouger pendant le feature freeze
 * (§4 et §9 du plan).
 */

export const LOCALES = ["fr", "en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Garde de type : le segment d'URL vient de l'utilisateur, jamais casté. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
