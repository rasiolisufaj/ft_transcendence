import { prisma } from "@/lib/db";

/**
 * TEMPORARY — the owner of documents until there are sessions.
 *
 * `requireUser()` already exists in `session.ts` but redirects to `/login`,
 * which C2 has not shipped yet. Until then the application names a user in
 * code. This file exists so that choice is made in **one place**: the day
 * `/login` exists, it is one substitution here, not a hunt for `findFirst`
 * calls scattered across pages and actions.
 *
 * PROJECT_PLAN §5 planned `AUTH_STUB=1` for exactly this need; this helper
 * stands in for it in the meantime.
 */

const SEED_USER_EMAIL = "Amir@gmail.com";

export async function getSeedUser() {
  const user = await prisma.user.findFirst({ where: { email: SEED_USER_EMAIL } });
  if (!user) {
    throw new Error(`Seed user not found (${SEED_USER_EMAIL}). Run \`npm run db:seed\`.`);
  }
  return user;
}
