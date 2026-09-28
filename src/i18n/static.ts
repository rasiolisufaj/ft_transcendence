import { setRequestLocale } from "next-intl/server";
import { isLocale } from "./config";

/**
 * Hands next-intl the locale of the current request, so a statically rendered
 * page can read a translation.
 *
 * Without it, next-intl looks the locale up in the request headers, which opts
 * the page into dynamic rendering. It has to be called by every statically
 * rendered page, not only by the layout: Next does not guarantee that a
 * layout's body runs before the page it wraps.
 *
 * The locale arrives as a plain URL segment, so it is narrowed rather than cast;
 * the layout is what turns an unknown one into a 404.
 *
 * This is also the single place that calls the deprecated `setRequestLocale`,
 * which is where the migration to `next/root-params` will happen:
 * https://next-intl.dev/blog/nextjs-root-params
 */
export function enableStaticRendering(locale: string): void {
  if (isLocale(locale)) setRequestLocale(locale);
}
