import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * Prefixes any URL without a locale with the default one: `/` → `/fr`,
 * `/documents/new` → `/fr/documents/new`.
 *
 * This is what lets old links and the `redirect()` calls in Server Actions stay
 * written without a prefix: the middleware normalises them. When D10 ships
 * next-intl, this is where `Accept-Language` negotiation and the `User.locale`
 * preference plug in — not in the pages.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const firstSegment = pathname.split("/")[1] ?? "";
  if (isLocale(firstSegment)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Outside locale routing:
   *   - `api`     : route handlers serve bytes, not pages (PROJECT_PLAN §2: the
   *                 file is served through /api/documents/[id])
   *   - `_next`   : Next's chunks, HMR and assets
   *   - `.*\..*`  : anything with an extension (favicon.ico, fonts…)
   */
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
