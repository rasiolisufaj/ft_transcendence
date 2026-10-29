import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/auth/policy";
import { getCurrentUser } from "@/lib/auth/session";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { AccountLinks, UserMenu } from "./UserMenu";

const link = "text-foreground-muted transition hover:text-foreground";
const primary =
  "rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:bg-primary-hover";

// getCurrentUser(), not requireUser(): the nav also renders on /login and /signup.
export async function Nav() {
  const t = await getTranslations("nav");
  const ctx = await getCurrentUser();

  const isAdmin = ctx !== null && can(ctx, "user:manage", {});
  // "MesPapiers": a fixed brand name, identical in every locale (checked in messages/*.json).
  // Split for a two-tone wordmark instead of a generic icon-in-a-box logo.
  const brand = t("brand");
  const brandLead = brand.slice(0, 3);
  const brandAccent = brand.slice(3);

  // The bar (from 768 px) splits the two jobs: NavLinks for the main sections,
  // UserMenu for account-only rows — so nothing is listed twice. The ☰ panel
  // (below) still lists every row through AccountLinks, since it is the only
  // menu a narrow screen gets.
  const barLinks = ctx ? (
    <>
      <NavLinks />
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <UserMenu name={ctx.user.displayName} userId={ctx.user.id} isAdmin={isAdmin} />
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

  const panelLinks = ctx ? (
    <>
      <p className="truncate px-3 py-2 text-xs text-foreground-muted">
        {ctx.user.displayName}
      </p>
      <ul>
        <AccountLinks userId={ctx.user.id} isAdmin={isAdmin} />
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
    // A floating capsule, not a square bar wall-to-wall: the page's paper
    // background shows at the sides, the nav reads as one object on it.
    <header className="sticky top-3 z-30 px-4">
      <nav className="relative mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-3 shadow-elevated">
        <Link
          href="/"
          className="flex items-baseline gap-0.5 font-serif text-lg font-semibold tracking-tight text-foreground"
        >
          <span>{brandLead}</span>
          <span className="text-primary">{brandAccent}</span>
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
