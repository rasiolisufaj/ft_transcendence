/**
 * The application's locales.
 *
 * PROJECT_PLAN §0: "Locales: `fr` (default), `en`, `es`". §5 names this file as
 * the place `Locale` is exported from.
 *
 * This file belongs to D10 (Alexandre). It holds only what routing needs —
 * next-intl, the message catalogues and the language switcher are still D10/D11
 * work. The `[locale]` segment is in place now so that no route has to move
 * during the feature freeze (§4 and §9 of the plan).
 */

export const LOCALES = ["fr", "en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Type guard: the URL segment comes from the user, so it is never cast. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
