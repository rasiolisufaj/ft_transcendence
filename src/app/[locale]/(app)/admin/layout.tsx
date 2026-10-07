import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { can } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

// §C-2: rendered, not thrown. error.tsx does not wrap the layout.tsx of its own
// segment, so a throw here escapes to the root boundary and shows a blank page —
// which C14's "not a blank page" explicitly forbids. Not the boundary either:
// every admin Server Action calls assertCan itself (§C-4).
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const ctx = await requireUser();

  if (!can(ctx, "user:manage", {})) {
    const t = await getTranslations("admin");
    return (
      <Card className="mx-auto mt-12 max-w-xl text-center">
        <h1 className="text-xl font-semibold">{t("forbiddenTitle")}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("forbiddenBody")}</p>
      </Card>
    );
  }

  return children;
}
