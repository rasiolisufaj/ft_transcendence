import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
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
function newEmail() {
  const email = `test-${randomUUID()}@mespapiers.test`;
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

  it("links an existing password account, even when Google sends its email in capitals", async () => {
    const email = newEmail();
    emails.push(email.toUpperCase()); // cleans up a duplicate if the normalisation ever breaks
    const owner = await prisma.user.create({
      data: { email, displayName: "Owner", passwordHash: await hashPassword("motdepasse123") },
    });

    expect(await resolveGoogleUser(google({ email: email.toUpperCase() }))).toBe(owner.id);

    expect(await prisma.user.count({ where: { email: { equals: email, mode: "insensitive" } } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).passwordHash).not.toBeNull();
    expect(await prisma.oAuthAccount.count({ where: { userId: owner.id } })).toBe(1);
  });

  it("refuses an email Google has not verified, and links nothing", async () => {
    const email = newEmail();
    await prisma.user.create({
      data: { email, displayName: "Owner", passwordHash: await hashPassword("motdepasse123") },
    });
    const profile = google({ email, email_verified: false });

    expect(await resolveGoogleUser(profile)).toBeNull();
    expect(await prisma.oAuthAccount.count({ where: { providerUserId: profile.sub } })).toBe(0);
  });

  it("names a new user after their email when Google has no name, and cuts a long one to 50", async () => {
    const noName = google({ email: newEmail(), name: undefined });
    const longName = google({ email: newEmail(), name: "A".repeat(70) });

    const a = await prisma.user.findUniqueOrThrow({ where: { id: (await resolveGoogleUser(noName))! } });
    const b = await prisma.user.findUniqueOrThrow({ where: { id: (await resolveGoogleUser(longName))! } });

    expect(a.displayName).toBe(noName.email.split("@")[0]);
    expect(b.displayName).toBe("A".repeat(50));
  });
});
