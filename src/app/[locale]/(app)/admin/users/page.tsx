export const dynamic = "force-dynamic";

import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { can } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { deleteUser, setGlobalRole } from "./actions";

export default async function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const ctx = await requireUser();
  // The layout's 403 card is not enough: a page still runs, and its output still
  // reaches the browser in the RSC payload, even when its layout does not render
  // it (Next's authentication guide, "Layouts and auth checks").
  if (!can(ctx, "user:manage", {})) return null;

  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  const t = await getTranslations("admin");
  const format = await getFormatter();

  // ponytail: no pagination; add take/skip when the list outgrows one page.
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    select: {
      id: true,
      email: true,
      displayName: true,
      globalRole: true,
      reputation: true,
      createdAt: true,
      _count: { select: { documents: true, sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>

      {/* A GET form: submitting it reloads this page with ?q=, no JavaScript needed. */}
      <form role="search" className="mb-6 flex items-end gap-2">
        <div className="flex-1">
          <Input type="search" name="q" defaultValue={q} label={t("searchLabel")} />
        </div>
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState title={t("empty", { q })} />
      ) : (
        // The less useful columns hide on narrow screens, so the page never scrolls sideways.
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t("columns.user")}</TableHeaderCell>
                <TableHeaderCell className="hidden sm:table-cell">{t("columns.role")}</TableHeaderCell>
                <TableHeaderCell className="hidden md:table-cell">{t("columns.documents")}</TableHeaderCell>
                <TableHeaderCell className="hidden md:table-cell">{t("columns.sessions")}</TableHeaderCell>
                <TableHeaderCell className="hidden lg:table-cell">{t("columns.reputation")}</TableHeaderCell>
                <TableHeaderCell className="hidden lg:table-cell">{t("columns.createdAt")}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t("columns.actions")}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
                const role = (
                  <Badge tone={user.globalRole === "ADMIN" ? "warning" : "neutral"}>
                    {t(`roles.${user.globalRole}`)}
                  </Badge>
                );
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p id={`user-${user.id}`} className="font-medium">
                        {user.displayName}
                      </p>
                      <p className="break-all text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                      <div className="mt-1 sm:hidden">{role}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{role}</TableCell>
                    <TableCell className="hidden md:table-cell">{user._count.documents}</TableCell>
                    <TableCell className="hidden md:table-cell">{user._count.sessions}</TableCell>
                    <TableCell className="hidden lg:table-cell">{user.reputation}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format.dateTime(user.createdAt, { dateStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      {/* Both actions refuse your own account, so your row gets no buttons. */}
                      {user.id === ctx.user.id ? (
                        <p className="text-right text-zinc-500 dark:text-zinc-400">{t("you")}</p>
                      ) : (
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-start sm:justify-end">
                          <form
                            action={setGlobalRole.bind(
                              null,
                              user.id,
                              user.globalRole === "ADMIN" ? "USER" : "ADMIN",
                            )}
                          >
                            <Button
                              type="submit"
                              variant="secondary"
                              aria-describedby={`user-${user.id}`}
                              className="whitespace-nowrap"
                            >
                              {user.globalRole === "ADMIN" ? t("demote") : t("promote")}
                            </Button>
                          </form>
                          {/* Two steps, so a stray click cannot delete an account and its papers. */}
                          <details className="text-right">
                            <summary
                              aria-describedby={`user-${user.id}`}
                              className="cursor-pointer list-none whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-400 [&::-webkit-details-marker]:hidden"
                            >
                              {t("delete")}
                            </summary>
                            <form action={deleteUser.bind(null, user.id)} className="mt-2">
                              <button
                                type="submit"
                                aria-describedby={`user-${user.id}`}
                                className="whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                              >
                                {t("confirmDelete")}
                              </button>
                            </form>
                          </details>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
