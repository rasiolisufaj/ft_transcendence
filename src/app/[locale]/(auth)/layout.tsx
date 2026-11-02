import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Login and signup are for visitors: a signed-in user who types their URL lands on the
// dashboard, like after a login. The pages are client components and cannot read the
// session cookie, so the check lives here, the mirror of (app)/layout.tsx's requireUser().
export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  if (await getCurrentUser()) {
    // `return`: TS only sees redirect() as never-returning with an explicit type.
    return redirect({ href: "/", locale: await getLocale() });
  }
  return children;
}
