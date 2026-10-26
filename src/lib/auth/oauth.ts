import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { emailField } from "./schemas";

/** Carries `<state>.<verifier>` from the start route to the callback (phase 8). */
export const OAUTH_COOKIE = "mp_oauth";
/** Sent only to the two Google routes. */
export const OAUTH_COOKIE_PATH = "/api/auth/google";

/** 256 random bits, base64url: an unguessable state, and a valid PKCE verifier (43 characters, RFC 7636 §4.1). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** PKCE S256 (RFC 7636 §4.2): Google keeps it and checks the verifier against it at the token exchange. */
export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Must match the Google console entry byte for byte. Google refuses `.local` hosts,
 * so Google sign-in is tested with APP_URL=https://localhost (phase 8 plan, decision 1).
 */
export function googleRedirectUri(): string {
  return `${process.env.APP_URL}/api/auth/google/callback`;
}

/** What the callback keeps from Google's userinfo answer. The email is normalised like signup's. */
export const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: emailField,
  email_verified: z.boolean(),
  name: z.string().optional(),
});
export type GoogleProfile = z.infer<typeof googleProfileSchema>;

/**
 * 8.4: the user a Google identity signs in as. An identity seen before signs in to its user;
 * else the account with the same email is linked; else a user is created, with no password.
 * Null when Google has not verified the email: anyone can put an address they do not own on
 * a Google account, and linking on it would hand them the account that owns it.
 */
export async function resolveGoogleUser(profile: GoogleProfile): Promise<string | null> {
  if (!profile.email_verified) return null;

  const identity = { provider: "google", providerUserId: profile.sub };
  const known = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: identity },
    select: { userId: true },
  });
  if (known) return known.userId;

  const existing = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true },
  });
  if (existing) {
    await prisma.oAuthAccount.create({ data: { ...identity, userId: existing.id } });
    return existing.id;
  }

  // ponytail: two callbacks for the same new email at once → the second create fails on the
  // unique email, and the callback's catch sends that browser to the login page. Fine at this scale.
  const created = await prisma.user.create({
    data: {
      email: profile.email,
      passwordHash: null,
      // The profile form's 2–50 rule is a form rule; the user can rename later (decision 4).
      displayName: (profile.name?.trim() || profile.email.slice(0, profile.email.indexOf("@"))).slice(0, 50),
      oauthAccounts: { create: identity },
    },
    select: { id: true },
  });
  return created.id;
}
