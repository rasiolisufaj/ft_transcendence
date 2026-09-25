import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

// Single source of truth for the proxy and the navigation helpers.
// "always" keeps the locale in every URL, including the default one (/fr/...).
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
