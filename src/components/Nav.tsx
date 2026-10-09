import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/auth/policy";
import { getCurrentUser } from "@/lib/auth/session";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileMenu } from "./MobileMenu";
import { AccountLinks, UserMenu } from "./UserMenu";

const link =
  "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
const primary =
  "rounded-lg bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

// getCurrentUser(), not requireUser(): the nav also renders on /login and /signup.
export async function Nav() {
  const t = await getTranslations("nav");
  const ctx = await getCurrentUser();

  const isAdmin = ctx !== null && can(ctx, "user:manage", {});

  // The bar (from 768 px) groups the account links in UserMenu; the ☰ panel (below) lists the same rows.
  const barLinks = ctx ? (
 <>
      <Link href="/channels" className={link}>
        {t("channels")}
      </Link>
      <UserMenu name={ctx.user.displayName} isAdmin={isAdmin} />
    </>  ) : (
    <>
      <Link href="/login" className={link}>
        {t("login")}
      </Link>
      <Link href="/channels" className={link}>
        {t("channels")}
      </Link>
      <Link href="/signup" className={primary}>
        {t("signup")}
      </Link>
    </>
  );

  const panelLinks = ctx ? (
    <>
      <p className="truncate px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
        {ctx.user.displayName}
      </p>
      <ul>
        <AccountLinks isAdmin={isAdmin} />
      </ul>
    </>
  ) : (
    <>
      <Link href="/login" className={`${link} px-3 py-3`}>
        {t("login")}
      </Link>
      <Link href="/signup" className={`${primary} mx-3 my-2 self-start`}>
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
          <div className="hidden items-center gap-6 md:flex">{barLinks}</div>
          <LocaleSwitcher />
          <MobileMenu>{panelLinks}</MobileMenu>
        </div>
      </nav>
    </header>
  );
}
