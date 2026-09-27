export const locales = ["fr", "en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

/** Type guard: the URL segment comes from the user, so it is never cast. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
