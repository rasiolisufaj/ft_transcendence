import { prisma } from "@/lib/db";

/**
 * TEMPORAIRE — le propriétaire des documents tant qu'il n'y a pas de session.
 *
 * `requireUser()` existe déjà dans `session.ts` mais redirige vers `/login`,
 * que C2 n'a pas encore livré. En attendant, l'application désigne un
 * utilisateur en dur. Ce fichier existe pour que ce choix soit fait **à un seul
 * endroit** : le jour où `/login` existe, c'est une substitution ici, pas une
 * chasse aux `findFirst` dispersés dans les pages et les actions.
 *
 * PROJECT_PLAN §5 prévoyait `AUTH_STUB=1` pour exactement ce besoin ; ce helper
 * en tient lieu jusque-là.
 */

const SEED_USER_EMAIL = "Amir@gmail.com";

export async function getSeedUser() {
  const user = await prisma.user.findFirst({ where: { email: SEED_USER_EMAIL } });
  if (!user) {
    throw new Error(
      `Utilisateur de seed introuvable (${SEED_USER_EMAIL}). Lancer \`npm run db:seed\`.`,
    );
  }
  return user;
}
