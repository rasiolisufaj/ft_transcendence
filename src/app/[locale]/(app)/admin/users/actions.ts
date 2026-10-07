"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { invalidateAllSessions, requireUser } from "@/lib/auth/session";

// The English throws below are not i18n keys, deliberately: the page renders no
// buttons on your own row and the layout hides it from non-admins, so only a
// forged request reaches them.

export async function setGlobalRole(userId: string, role: "USER" | "ADMIN"): Promise<void> {
  const ctx = await requireUser();
  assertCan(ctx, "user:manage", {});

  // An admin who demotes themselves can lock the last admin out of the admin surface.
  if (userId === ctx.user.id) throw new Error("You cannot change your own role.");

  await prisma.user.update({ where: { id: userId }, data: { globalRole: role } });

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
  await prisma.user.delete({ where: { id: userId } });

  // After the delete, so a failed one (a double click) records nothing. targetId
  // is a plain string, not a foreign key, so it outlives the row.
  await writeAudit({
    actorUserId: ctx.user.id,
    action: "user:delete",
    targetType: "User",
    targetId: userId,
  });

  revalidatePath("/[locale]/(app)/admin/users", "page");
}
