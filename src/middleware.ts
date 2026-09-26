import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * Préfixe toute URL sans locale par la locale par défaut : `/` → `/fr`,
 * `/documents/new` → `/fr/documents/new`.
 *
 * C'est ce qui permet aux anciens liens et aux `redirect()` des Server Actions
 * de rester écrits sans préfixe : le middleware normalise. Quand D10 livrera
 * `next-intl`, c'est ici que la négociation `Accept-Language` et la préférence
 * `User.locale` viendront se brancher — pas dans les pages.
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
   * Hors du routage par locale :
   *   - `api`     : les route handlers servent des octets, pas des pages
   *                 (PROJECT_PLAN §2 : le fichier passe par /api/documents/[id])
   *   - `_next`   : chunks, HMR et assets de Next
   *   - `.*\..*`  : tout ce qui porte une extension (favicon.ico, polices…)
   */
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
