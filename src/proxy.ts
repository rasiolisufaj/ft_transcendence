import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 renamed middleware.ts to proxy.ts. Redirects / to /fr (or the
// browser's language) and keeps the locale prefix on every page route.
export default createMiddleware(routing);

export const config = {
  // Skip Route Handlers (/api), Next internals and any path with a file extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
