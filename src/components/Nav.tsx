import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/auth/policy";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/app/[locale]/(auth)/logout/actions";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileMenu } from "./MobileMenu";

const link = "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
const primary =
  "rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

// getCurrentUser(), not requireUser(): the nav also renders on /login and /signup.
export async function Nav() {
  const t = await getTranslations("nav");
  const ctx = await getCurrentUser();

  // Rendered twice: in the bar from 1024 px (lg), in the ☰ panel below. At 768 px
  // the admin link and a long display name no longer fit on one row.
  const links = ctx ? (
    <>
      <Link href="/" className={link}>
        {t("dashboard")}
      </Link>
      {can(ctx, "user:manage", {}) && (
        <Link href="/admin/users" className={link}>
          {t("admin")}
        </Link>
      )}
      <Link href="/documents/new" className={primary}>
        {t("addDocument")}
      </Link>
      <span className="max-w-40 truncate text-zinc-600 dark:text-zinc-400">
        {ctx.user.displayName}
      </span>
      <form action={logout}>
        <button type="submit" className={link}>
          {t("logout")}
        </button>
      </form>
    </>
  ) : (
    <>
      <Link href="/login" className={link}>
        {t("login")}
      </Link>
      <Link href="/signup" className={primary}>
        {t("signup")}
      </Link>
    </>
  );

  return (
    <header className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          {t("brand")}
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <div className="hidden items-center gap-6 lg:flex">{links}</div>
          <LocaleSwitcher />
          <MobileMenu>{links}</MobileMenu>
        </div>
      </nav>
    </header>
  );
}
