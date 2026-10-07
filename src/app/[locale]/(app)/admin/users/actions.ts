"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { invalidateAllSessions, requireUser } from "@/lib/auth/session";

// The English throws below are not i18n keys, deliberately: the page renders no
// buttons on your own row and the layout hides it from non-admins, so only a
// forged request reaches them.

// P2025: no row matched. The user is already gone, or already has that role (a
// double click, a stale page, another admin). Nothing changed, so nothing to record.
const nothingMatched = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export async function setGlobalRole(userId: string, role: "USER" | "ADMIN"): Promise<void> {
  const ctx = await requireUser();
  assertCan(ctx, "user:manage", {});

  // Bound arguments come back from the browser, so a forged request can send anything.
  if (typeof userId !== "string" || (role !== "USER" && role !== "ADMIN")) {
    throw new Error("Invalid arguments.");
  }

  // An admin who demotes themselves can lock the last admin out of the admin surface.
  if (userId === ctx.user.id) throw new Error("You cannot change your own role.");

  try {
    await prisma.user.update({
      where: { id: userId, globalRole: { not: role } },
      data: { globalRole: role },
    });
  } catch (error) {
    if (nothingMatched(error)) return;
    throw error;
  }

  // C11: a privilege change invalidates every existing session of that user, so a
  // demoted admin does not keep admin rights until their cookie happens to expire.
  await invalidateAllSessions(userId);

  await writeAudit({
    actorUserId: ctx.user.id,
    action: "user:setGlobalRole",
    targetType: "User",
    targetId: userId,
    metadata: { role },
  });

  // The route FILE pattern: "/admin/users" matches nothing under [locale].
  revalidatePath("/[locale]/(app)/admin/users", "page");
}

export async function deleteUser(userId: string): Promise<void> {
  const ctx = await requireUser();
  assertCan(ctx, "user:manage", {});

  // Also what keeps the audit row below valid: its actor still exists.
  if (userId === ctx.user.id) throw new Error("You cannot delete your own account here.");

  // Cascades the user's sessions, documents and memberships. A channel left
  // without a moderator is accepted (§C-19).
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    if (nothingMatched(error)) return;
    throw error;
  }

  // After the delete, so only a delete that happened is recorded. targetId is a
  // plain string, not a foreign key, so it outlives the row.
  await writeAudit({
    actorUserId: ctx.user.id,
    action: "user:delete",
    targetType: "User",
    targetId: userId,
  });

  revalidatePath("/[locale]/(app)/admin/users", "page");
}
