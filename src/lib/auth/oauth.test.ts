import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { createSession, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { challengeFor, googleProfileSchema, resolveGoogleUser } from "./oauth";

describe("challengeFor", () => {
  it("is base64url(sha256(verifier)): RFC 7636's Appendix B pair", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

const emails: string[] = [];
// Link tests use Gmail addresses: Google sign-in links only the mailboxes Google hosts (decision 11).
function newEmail(domain = "mespapiers.test") {
  const email = `test-${randomUUID()}@${domain}`;
  emails.push(email);
  return email;
}
// What the callback gets once Google's userinfo answer is parsed.
const google = (fields: Record<string, unknown>) =>
  googleProfileSchema.parse({ sub: randomUUID(), email_verified: true, name: "Marie Curie", ...fields });

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } }); // OAuthAccount rows cascade
  emails.length = 0;
});

describe("resolveGoogleUser", () => {
  it("creates a user with no password and its Google account, then signs in to it", async () => {
    const profile = google({ email: newEmail() });

    const id = await resolveGoogleUser(profile);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: id! },
      include: { oauthAccounts: true },
    });
    expect(user).toMatchObject({ email: profile.email, displayName: "Marie Curie", passwordHash: null });
    expect(user.oauthAccounts).toEqual([
      expect.objectContaining({ provider: "google", providerUserId: profile.sub }),
    ]);
    expect(await resolveGoogleUser(profile)).toBe(id);
  });

  it("signs a known Google identity in even when its email has changed and is not verified yet", async () => {
    // The sub is the identity (Google: "Always use the sub field"); the email only links or creates.
    const profile = google({ email: newEmail() });
    const id = await resolveGoogleUser(profile);

    expect(await resolveGoogleUser({ ...profile, email: newEmail(), email_verified: false })).toBe(id);
  });

  it("links an existing password account, even when Google sends its email in capitals", async () => {
    const email = newEmail("gmail.com");
    emails.push(email.toUpperCase()); // cleans up a duplicate if the normalisation ever breaks
    const owner = await prisma.user.create({
      data: { email, displayName: "Owner", passwordHash: await hashPassword("motdepasse123") },
    });

    expect(await resolveGoogleUser(google({ email: email.toUpperCase() }))).toBe(owner.id);

    expect(await prisma.user.count({ where: { email: { equals: email, mode: "insensitive" } } })).toBe(1);
    expect(await prisma.oAuthAccount.count({ where: { userId: owner.id } })).toBe(1);
  });

  it("takes a linked account back from whoever set its password: the password and every open session end", async () => {
    // Signup never checks that you own the address, so that password may be an impostor's (final review).
    const email = newEmail("gmail.com");
    const squatter = await prisma.user.create({
      data: { email, displayName: "Squatter", passwordHash: await hashPassword("motdepasse123") },
    });
    const { token } = await createSession(squatter.id);

    await resolveGoogleUser(google({ email }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: squatter.id } })).passwordHash).toBeNull();
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("refuses an email Google has not verified: nothing is linked or created", async () => {
    const email = newEmail("gmail.com");
    await prisma.user.create({
      data: { email, displayName: "Owner", passwordHash: await hashPassword("motdepasse123") },
    });
    const link = google({ email, email_verified: false });
    const create = google({ email: newEmail(), email_verified: false });

    expect(await resolveGoogleUser(link)).toBeNull();
    expect(await resolveGoogleUser(create)).toBeNull();
    expect(await prisma.oAuthAccount.count({ where: { providerUserId: { in: [link.sub, create.sub] } } })).toBe(0);
    expect(await prisma.user.count({ where: { email: create.email } })).toBe(0);
  });

  it.each(["mespapiers.test", "notgmail.com"])(
    "links only a Gmail address: on @%s the account keeps its password and sessions, and nothing is linked",
    async (domain) => {
      // Elsewhere email_verified may date from the Google account's creation, and the address
      // may have changed hands since (Google, "Verify the Google ID token").
      const email = newEmail(domain);
      const owner = await prisma.user.create({
        data: { email, displayName: "Owner", passwordHash: await hashPassword("motdepasse123") },
      });
      const { token } = await createSession(owner.id);
      const profile = google({ email });

      expect(await resolveGoogleUser(profile)).toBeNull();

      expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).passwordHash).not.toBeNull();
      expect(await validateSessionToken(token)).not.toBeNull();
      expect(await prisma.oAuthAccount.count({ where: { providerUserId: profile.sub } })).toBe(0);
    },
  );

  it("names a new user after their email when Google has no name, and cuts a long one to 50", async () => {
    const noName = google({ email: newEmail(), name: undefined });
    const longName = google({ email: newEmail(), name: "A".repeat(70) });

    const a = await prisma.user.findUniqueOrThrow({ where: { id: (await resolveGoogleUser(noName))! } });
    const b = await prisma.user.findUniqueOrThrow({ where: { id: (await resolveGoogleUser(longName))! } });

    expect(a.displayName).toBe(noName.email.split("@")[0]);
    expect(b.displayName).toBe("A".repeat(50));
  });

  it("cuts a long name between characters, never inside one", async () => {
    // Cutting at 50 UTF-16 units would keep half of this emoji, which the database refuses.
    const profile = google({ email: newEmail(), name: `${"A".repeat(49)}😀 Curie` });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: (await resolveGoogleUser(profile))! } });

    expect(user.displayName).toBe(`${"A".repeat(49)}😀`);
  });
});
