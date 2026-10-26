# Phase 8 — OAuth 2.0 Google (C7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor clicks *Continuer avec Google* on the login or signup page, consents on Google, and comes back signed in: to the account that Google identity used before, or to the existing account with the same (verified) email, now linked, or to a new account with no password. An account with no password can still delete itself, by typing its email.

**Architecture:** A hand-written authorization-code flow with PKCE (S256), as `PROJECT_PLAN.md` §2 decided (Arctic is deprecated). Two Route Handlers, `GET /api/auth/google/start` and `GET /api/auth/google/callback`, and one module, `src/lib/auth/oauth.ts`, which holds the PKCE helpers, the shape of Google's profile and the account resolution. `state` and the PKCE verifier ride in one `httpOnly` cookie that lives 10 minutes and is cleared by every answer of the callback, so each value works once. The session is the existing one: `createSession()` + `setSessionCookie()`. No migration, no dependency. The published `SessionContext` does not change.

**Tech Stack:** Next.js 16 Route Handlers (`NextRequest`, `NextResponse`) · `node:crypto` · `fetch` · Zod 4 · Prisma 6 (`@/generated/prisma/client`) · Vitest against the dev Postgres · `next-intl`

**Spec:** [`2026-09-21-rasiol-modules-roadmap.md`](2026-09-21-rasiol-modules-roadmap.md) phase 8 (tasks 8.1–8.5, its two *Watch for* notes) · [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) §7 C7 (*sign-in completes with `state` and `code_verifier` both single-use and expiring; a replayed callback is rejected*), §2 (hand-rolled `fetch` + PKCE) · vision, *Minor: Implement remote authentication with OAuth 2.0* (Google sign-in, PKCE, linking when the email already has a password account) · the Keep vs. Cut below (Rasiol's calls, 2026-10-26).

**Branch:** `feat/oauth-google`, cut from `main` = `d47f258` (PR #38). Its first commit is this file plus the 2026-10-26 docs sync (`CLAUDE.md`, the roadmap, `PROJECT_PLAN.md`, `handoff/WORKLOG.md`). Files outside Rasiol's: `src/app/[locale]/(app)/account/data/` (Amir reviews Task 4), `src/components/ui/` and the gallery (Alexandre reviews Task 3's primitive), `docker-compose.yml` (Adrien). Tag them on the PR.

## Design decisions (Rasiol, 2026-10-26)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | The redirect host (8-A) | **`https://localhost/api/auth/google/callback`**, registered in the Google console. `APP_URL=https://localhost` in `.env` while testing Google, and the whole flow starts on `https://localhost`. Every other check stays on `https://mespapiers.local` | Google refuses a redirect host whose TLD is not on the public suffix list (`.local`, `*.localhost`), with `localhost` as the one exception. nginx already serves `localhost` (`server_name mespapiers.local localhost`), so nothing new is built. The state cookie belongs to the host that set it: a flow started on `mespapiers.local` comes back to `localhost` without it, and ends on the login page's error (B15 row 7) |
| 2 | Deleting an account with no password (8-B) | **It types its email** instead of the password, in Amir's `deleteAccount`, under the same rate limiter. The form shows an email field when the account has no password | Phase 8 creates such accounts, and today `deleteAccount` answers `wrongPassword` to them, so they could never delete themselves (E13, GDPR erasure). A fresh Google round trip would be a second OAuth flow for one button |
| 3 | An email Google has not verified (8-C) | **Refused**, before anything is read or written | Anyone can put an address they do not own on a Google account. Linking on it would hand them the account that owns the address |
| 4 | A new user's display name (8-D) | Google's `name`, trimmed, else the email's local part, **cut to 50** | The 2–50 rule belongs to the forms (`displayNameField`); the column takes any string, and the user can rename on their profile |
| 5 | Where the identity comes from (8-E) | **Google's userinfo endpoint** (`https://openidconnect.googleapis.com/v1/userinfo`), with the access token from the exchange. The `id_token` is ignored | One `fetch` and plain JSON, checked by a Zod schema. Reading the ID token brings its own `iss`/`aud` checks and a "why no signature check?" at the defence; GitHub (phase 9) has no ID token either, only `/user` |
| 6 | The button | **A primitive, `src/components/ui/GoogleButton.tsx`**: an `<a>` with Google's "G" logo, in the `/dev/ui` gallery, used on the login **and** signup pages | Rasiol's call. A link, not a `<button>`: it navigates. The caller passes a plain `href`: the i18n `Link` would make `/fr/api/auth/google/start`, a 404 |
| 7 | `state` and the verifier | **One cookie**, `mp_oauth` = `<state>.<verifier>` (base64url has no `.`), `httpOnly`, `Secure`, `sameSite: lax`, `path: /api/auth/google`, `maxAge: 600` | One value to set, read and clear. `lax`, not `strict`: Google's redirect back is a cross-site navigation, and `strict` would drop the cookie (roadmap *Watch for*). The path keeps it off every other request |
| 8 | Failures | Every failure redirects to `/login?error=oauth`; the client page reads it with `use(searchParams)` (Next docs, `page.md`, *Client Component pages*) and shows one key, `auth.errors.oauthFailed`. Google's text is never shown. Unexpected ones are logged with `console.error` | One message for a cancelled consent, a refused exchange, an unverified email, Google being down. The log is what B15 needs when the console entry is wrong |
| 9 | A checkout without Google keys | The start route sends the browser back to `/login?error=oauth` instead of to Google | Three teammates will have empty `GOOGLE_*` keys; Google's own error page would read as a bug in the app |

## Keep vs. Cut (2026-10-26)

Proposed by Claude, decided by Rasiol. Measured against C7's Done-when, the vision's OAuth line and the subject's minor.

| Roadmap item or idea | Ruling | Becomes |
|---|---|---|
| 8.1 `oauth/pkce.ts` with `createVerifier()`, `challengeFor()`, `createState()` | **Keep, slimmed** | `randomToken()` (state and verifier are the same kind of value) and `challengeFor()`, in `src/lib/auth/oauth.ts`; one test on RFC 7636's Appendix B pair |
| The `oauth/` directory, `providers.ts` config objects | **Cut** | one file; phase 9.1 generalises when GitHub comes |
| 8.2 start route, 8.3 callback | **Keep** | as written, with decision 7's single cookie |
| 8.4 the three branches | **Keep, plus** | decision 3's refusal |
| 8.5 the link on login and signup | **Keep** (signup: Rasiol) | decision 6 |
| Button primitive, Google logo, gallery entry | **Keep** (Rasiol) | decision 6 |
| `?error=oauth` on the login page | **Keep** | decision 8 |
| `.env.example` + compose | **Keep** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` uncommented; compose forwards them and `APP_URL` |
| OAuth-only deletion | **Keep** | decision 2 |
| Reading the `id_token` | **Cut** | decision 5 |
| `nonce` | **Cut** | `state` + PKCE already bind the code to this browser; a nonce protects ID tokens, which are not used |
| Storing access or refresh tokens | **Cut** | the identity is needed once; `OAuthAccount` has no token columns |
| New infra for 8-A (a `nip.io` host, a cert, a `server_name`) | **Cut** | decision 1 |
| Validating Google's name with `displayNameField` | **Cut** | decision 4 |
| Audit rows or mails on link/create; a rate limit on the OAuth routes; return to the page you came from; unlink, connected accounts, setting a password | **Cut** | not in C7, the vision or the subject |
| Two callbacks for the same new email at once | **Cut** | the second `create` fails on the unique email; the callback's `catch` sends that browser to the login page (a `ponytail:` comment) |

## Components

| Unit | What it does | Used by |
|---|---|---|
| `src/lib/auth/oauth.ts` — `OAUTH_COOKIE`, `OAUTH_COOKIE_PATH`, `randomToken()`, `challengeFor(verifier)`, `googleRedirectUri()`, `googleProfileSchema`, `GoogleProfile`, `resolveGoogleUser(profile)` | PKCE, the redirect URI, the profile's shape (email normalised like signup's), and which user an identity signs in as | the two routes |
| `src/lib/auth/schemas.ts` — `emailField` (now exported) | trim, lowercase, `z.email()` | signup, login, `googleProfileSchema`, `deleteWithEmailSchema` |
| `src/app/api/auth/google/start/route.ts` — `GET()` | sets `mp_oauth`, redirects to Google with an S256 challenge | `GoogleButton`'s `href` |
| `src/app/api/auth/google/callback/route.ts` — `GET(request)` | checks `state`, exchanges the code with the verifier, reads userinfo, resolves the user, creates the session; every answer clears `mp_oauth` | Google |
| `src/components/ui/GoogleButton.tsx` | the styled link with the "G" | the login and signup pages, the gallery |
| `account/data/{schemas,actions,DeleteAccountForm,page}` (Amir's) | `deleteWithEmailSchema`; `deleteAccount` confirms with the email when there is no password | `/account/data` |

**Message keys:** `auth.continueWithGoogle`, `auth.errors.oauthFailed`, `myData.emailLabel`, `myData.wrongEmail`, in `fr.json` first (it types `t()`), then `en.json` and `es.json`.

## Data flow

- **Start:** the link → `GET /api/auth/google/start` → no `GOOGLE_CLIENT_ID`: redirect to `/login?error=oauth` → else `state = randomToken()`, `verifier = randomToken()`, cookie `mp_oauth=<state>.<verifier>`, redirect to `https://accounts.google.com/o/oauth2/v2/auth?client_id&redirect_uri&response_type=code&scope=openid email profile&state&code_challenge&code_challenge_method=S256`.
- **Callback:** `GET /api/auth/google/callback?code&state` (or `?error=access_denied&state`) → split the cookie; no cookie, no `code`, or `state` ≠ the cookie's → `/login?error=oauth`, Google is not called → `POST https://oauth2.googleapis.com/token` (`client_id`, `client_secret`, `code`, `code_verifier`, `grant_type=authorization_code`, `redirect_uri`) → `GET` userinfo with the access token → `googleProfileSchema.parse` → `resolveGoogleUser()` (null → `/login?error=oauth`) → `createSession()` + `setSessionCookie()` → `/`. Every answer clears `mp_oauth`. Any throw (network, a non-2xx answer, unreadable JSON, a database error) is logged and ends on `/login?error=oauth`.
- **Resolution:** email not verified → null. A known `OAuthAccount (google, sub)` → its user. A `User` with that email → link a new `OAuthAccount` to it. Else → a new `User` (`passwordHash: null`) with its `OAuthAccount`, in one `create`.
- **Locale:** the callback redirects to `/` and `/login?error=oauth` without a prefix; the next-intl middleware adds it from the `NEXT_LOCALE` cookie and keeps the query string.
- **Deleting an OAuth-only account:** `/account/data` reads `passwordHash` → `DeleteAccountForm hasPassword={false}` shows an email field → `deleteAccount` → limiter → `deleteWithEmailSchema` → typed email (normalised) = `ctx.user.email`, else `wrongEmail` (counted by the limiter) → the existing transaction, mail, audit, redirect.

## Error handling

- The browser only ever sees `/login?error=oauth` and one translated message. Google's error text, status codes and the reason stay in the server log.
- The callback never answers 500 for a Google or database problem: one `try`/`catch` around everything after the state check.
- `deleteAccount`'s new branch returns keys (`emailInvalid`, `wrongEmail`, `tooManyAttempts`) and changes nothing on a mistake, like the password branch.

## Testing

| File | Tests | Needs the DB |
|---|---|---|
| `src/lib/auth/oauth.test.ts` (new) | `challengeFor` on RFC 7636's pair; `resolveGoogleUser`: creates a passwordless user and signs in to it next time; links a password account whose email Google sends in capitals; refuses an unverified email; falls back to the local part and cuts at 50 | 4 of 5 |
| `src/app/api/auth/google/start/route.test.ts` (new) | the redirect (S256, state, client, redirect URI) and the cookie's attributes; no client id → the login page | 0 of 2 |
| `src/app/api/auth/google/callback/route.test.ts` (new) | a wrong state calls nothing; a sign-in sends the verifier, clears the cookie, and the replay is refused; a cancelled consent and Google down end on the login page | 1 of 3 |
| `account/data/actions.test.ts` (Amir's) | an account with no password: a wrong email is refused, its own email (any case) deletes it | 1 of 1 |

`npm test`: 262 → **273** (24 → 27 files; 80 → 86 need the DB). Plus **B15** in a real browser with a real Google account (Task 5): no unit test can reach Google.

## Global Constraints

Every task's definition of done includes this section.

- Import Prisma from `@/generated/prisma/client`, never `@prisma/client`. Use the `prisma` singleton from `src/lib/db.ts`.
- Each form has **one Zod schema module imported by both the client component and the server action** (plan §0). Validate everything that crosses a trust boundary, Google's answers included.
- Every user-visible string is a `next-intl` key. `fr.json` first (it types `t()`), then `en.json` and `es.json`. `npm run i18n:check` sees only literal `t("key")` calls and `` t(`prefix.${x}`) `` templates.
- API routes stay under `src/app/api/` (not localised). Links to them are plain `href`s, never the i18n `Link`.
- A new primitive in `src/components/ui/` also goes into the gallery at `src/app/[locale]/dev/ui/page.tsx`.
- Secrets live only in `.env` (git-ignored). `.env.example` lists every key with an empty or dummy value; compose forwards what `web` needs (it does not pass `.env` through).
- The session cookie and `mp_oauth` are `Secure` always (compose runs `next dev` behind nginx TLS).
- The published `SessionContext` does not change.
- Zero ESLint warnings. Zero console errors or warnings on every route. Responsive and keyboard-navigable at 375 / 768 / 1440.
- Conventional Commits (`feat(auth): …`). **No commit without Rasiol's go-ahead**; stage by path, never `git add -A`.
- DB tests hit the real Postgres from `.env`. Each creates its own `test-<uuid>@mespapiers.test` users and deletes them afterwards (`Session` and `OAuthAccount` cascade from `User`).
- If DB tests fail with `could not locate the Query Engine for runtime "debian-openssl-3.0.x"`: `docker exec mespapiers_web chown -R $(id -u):$(id -g) /app/src/generated && npm run db:generate` (`CLAUDE.md`, *Prisma engine flips*).
- Browser checks run on `https://mespapiers.local`, **except Google sign-in**, which runs on `https://localhost` (decision 1).

## Review Focus

Inputs the spec implies but its Done-when does not test, most likely to bite first. Each has its test in the task that owns the code.

1. **A checkout without Google keys** (every teammate's): expected, the login page with the message, not Google's *missing client_id* page. Task 2, start test 2.
2. **The user cancels on Google's consent screen** (`?error=access_denied&state=…`): expected, the login page with the message, and no token request. Task 2, callback test 3.
3. **Google unreachable, or answering an error or something that is not JSON:** expected, the login page with the message, not a 500, and the cause in the server log. Task 2, callback test 3.
4. **A Google email in capitals** for an account that signup stored in lowercase: expected, the same account, linked, not a second user. Task 1, resolution test 2.
5. **A Google profile with no name, or a 70-character one:** expected, a usable display name (the local part; the first 50 characters). Task 1, resolution test 4.

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `src/lib/auth/schemas.ts` | 1 | export `emailField` |
| `src/lib/auth/oauth.ts` (new) + `oauth.test.ts` | 1 | PKCE, the redirect URI, the profile schema, `resolveGoogleUser` |
| `src/app/api/auth/google/start/route.ts` (new) + `route.test.ts` | 2 | 8.2 |
| `src/app/api/auth/google/callback/route.ts` (new) + `route.test.ts` | 2 | 8.3 |
| `.env.example`, `docker-compose.yml` | 2 | the Google keys, `APP_URL` |
| `src/components/ui/GoogleButton.tsx` (new), `src/app/[locale]/dev/ui/page.tsx` | 3 | the primitive and its gallery entry |
| `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/signup/page.tsx` | 3 | the button; the login page's `?error=oauth` |
| `src/app/[locale]/(app)/account/data/{schemas.ts,actions.ts,actions.test.ts,DeleteAccountForm.tsx,page.tsx}` | 4 | decision 2 (Amir reviews) |
| `messages/{fr,en,es}.json` | 3, 4 | the four keys |
| `docs/testing-auth.md`, `CLAUDE.md`, the roadmap, `PROJECT_PLAN.md`, `handoff/WORKLOG.md` | 5 | B15 and the docs |

---

## Tasks

### Task 0: Environment, branch, docs commit

**Files:** the docs edited on `main` on 2026-10-26 (uncommitted): `CLAUDE.md`, `handoff/WORKLOG.md`, `docs/plans/2026-09-21-rasiol-modules-roadmap.md`, `PROJECT_PLAN.md`, and this file.

- [ ] **Step 1: The database**

Docker Desktop's WSL integration was off on 2026-10-26 (`docker` not found). Turn it on (Docker Desktop → Settings → Resources → WSL integration), then:

```bash
docker compose up -d
docker exec mespapiers_web chown -R $(id -u):$(id -g) /app/src/generated && npm run db:generate
npx vitest run --maxWorkers=1
```

Expected: `Tests  262 passed (262)`, 24 files. Any other count: stop and find out why before writing code.

- [ ] **Step 2: Check the tree and the remote**

Run: `git fetch --prune && git status --short && git log --oneline -1 origin/main`
Expected: only the five files above modified or untracked; `origin/main` is `d47f258` or later. If it moved, `git stash`, `git pull`, `git stash pop`, and resolve.

- [ ] **Step 3: Cut the branch**

Run: `git switch -c feat/oauth-google`
Expected: `Switched to a new branch 'feat/oauth-google'`, the edits carried over.

- [ ] **Step 4: Commit the docs (with Rasiol's go-ahead)**

```bash
git add CLAUDE.md handoff/WORKLOG.md PROJECT_PLAN.md docs/plans/2026-09-21-rasiol-modules-roadmap.md docs/plans/2026-10-26-c7-oauth-google.md
git commit -m "docs: phase 8 plan and Keep vs. Cut"
```

- [ ] **Step 5 (Rasiol, any time before Task 5): the Google client.** In the Google Cloud console, create a project, then in *Google Auth Platform*: *Branding* (app name, support email); *Audience*: External, **Testing**, and add the Google address you will test with as a test user; *Clients* → *Create client* → *Web application*, with one *Authorized redirect URI*: `https://localhost/api/auth/google/callback`. Put the client ID and secret in `.env` (never in `.env.example`) once Task 2 has added the keys.

---

### Task 1: PKCE helpers and account resolution (8.1, 8.4)

**Files:**
- Modify: `src/lib/auth/schemas.ts` (export `emailField`)
- Create: `src/lib/auth/oauth.ts`
- Test: `src/lib/auth/oauth.test.ts`

**Interfaces:**
- Consumes: `emailField` (`src/lib/auth/schemas.ts`), `prisma`.
- Produces (Task 2 relies on these exact names):
  - `OAUTH_COOKIE = "mp_oauth"`, `OAUTH_COOKIE_PATH = "/api/auth/google"`
  - `randomToken(): string`, `challengeFor(verifier: string): string`, `googleRedirectUri(): string`
  - `googleProfileSchema` (Zod object: `sub`, `email` normalised, `email_verified: boolean`, `name?`), `type GoogleProfile`
  - `resolveGoogleUser(profile: GoogleProfile): Promise<string | null>` (a user id, or null when the email is not verified)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/oauth.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { challengeFor, googleProfileSchema, resolveGoogleUser } from "./oauth";

describe("challengeFor", () => {
  it("is base64url(sha256(verifier)): RFC 7636's Appendix B pair", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbjZGWTxu9S0",
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/auth/oauth.test.ts`
Expected: FAIL, `Failed to resolve import "./oauth"`.

- [ ] **Step 3: Export `emailField`**

In `src/lib/auth/schemas.ts`, change `const emailField = z` to `export const emailField = z`, and put this line above it:

```ts
/** Shared by signup, login, Google's profile (oauth.ts) and the account deletion form. */
```

- [ ] **Step 4: Write `src/lib/auth/oauth.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/lib/auth/oauth.test.ts src/lib/auth/schemas.test.ts`
Expected: PASS, 5 tests in `oauth.test.ts` and `schemas.test.ts` unchanged.

- [ ] **Step 6: Check a test guards the refusal.** Comment out `if (!profile.email_verified) return null;`, rerun `oauth.test.ts`: *refuses an email Google has not verified* must fail. Put the line back.

- [ ] **Step 7: Lint and commit (with Rasiol's go-ahead)**

```bash
npx eslint src/lib/auth
git add src/lib/auth/schemas.ts src/lib/auth/oauth.ts src/lib/auth/oauth.test.ts
git commit -m "feat(auth): PKCE helpers and Google account resolution"
```

---

### Task 2: The start and callback routes (8.2, 8.3)

**Files:**
- Create: `src/app/api/auth/google/start/route.ts`, `src/app/api/auth/google/start/route.test.ts`
- Create: `src/app/api/auth/google/callback/route.ts`, `src/app/api/auth/google/callback/route.test.ts`
- Modify: `.env.example`, `docker-compose.yml`

**Interfaces:**
- Consumes: everything Task 1 produces; `createSession(userId): Promise<{ token: string; expiresAt: Date }>` and `setSessionCookie(token, expiresAt): Promise<void>` from `src/lib/auth/session.ts`.
- Produces: `GET /api/auth/google/start` (Task 3's `href`); every failure redirects to `/login?error=oauth` (Task 3 reads `error === "oauth"`).

- [ ] **Step 1: Write the failing start tests**

Create `src/app/api/auth/google/start/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { challengeFor } from "@/lib/auth/oauth";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://localhost");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/auth/google/start", () => {
  it("sends the browser to Google with an S256 challenge, and keeps state and verifier in a 10-minute cookie", () => {
    const res = GET();

    const to = new URL(res.headers.get("location")!);
    expect(`${to.origin}${to.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(to.searchParams.get("client_id")).toBe("client-id");
    expect(to.searchParams.get("redirect_uri")).toBe("https://localhost/api/auth/google/callback");
    expect(to.searchParams.get("response_type")).toBe("code");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");

    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("mp_oauth="))!;
    const [state, verifier] = cookie.slice("mp_oauth=".length).split(";")[0]!.split(".");
    expect(to.searchParams.get("state")).toBe(state);
    expect(to.searchParams.get("code_challenge")).toBe(challengeFor(verifier!));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=600/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
  });

  it("goes back to the login page when no Google client is configured", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");

    const res = GET();

    expect(res.headers.get("location")).toBe("https://localhost/login?error=oauth");
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing callback tests**

Create `src/app/api/auth/google/callback/route.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GET } from "./route";

// next/headers' cookies() needs a request scope; createSession() stays real.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  setSessionCookie: vi.fn(),
}));

const fetchMock = vi.fn();
const STATE = "the-state";
const VERIFIER = "the-verifier";
const LOGIN_ERROR = "https://localhost/login?error=oauth";

function callback(query: string, cookie: string | null = `${STATE}.${VERIFIER}`) {
  return GET(
    new NextRequest(`https://localhost/api/auth/google/callback?${query}`, {
      headers: cookie ? { cookie: `mp_oauth=${cookie}` } : {},
    }),
  );
}
const clearsTheCookie = (res: Response) =>
  res.headers.getSetCookie().some((c) => c.startsWith("mp_oauth=;") && /Max-Age=0/i.test(c));

const emails: string[] = [];

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://localhost");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.clearAllMocks();
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  emails.length = 0;
});

describe("GET /api/auth/google/callback", () => {
  it("refuses a state that does not match its cookie, before calling Google", async () => {
    const res = await callback("code=c&state=another-state");

    expect(res.headers.get("location")).toBe(LOGIN_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearsTheCookie(res)).toBe(true);
  });

  it("signs in with the verifier, clears the cookie, and refuses the same callback replayed", async () => {
    const email = `test-${randomUUID()}@mespapiers.test`;
    emails.push(email);
    fetchMock
      .mockResolvedValueOnce(Response.json({ access_token: "access" }))
      .mockResolvedValueOnce(Response.json({ sub: randomUUID(), email, email_verified: true, name: "Test" }));

    const res = await callback(`code=c&state=${STATE}`);

    expect(res.headers.get("location")).toBe("https://localhost/");
    expect(setSessionCookie).toHaveBeenCalledOnce();
    expect(clearsTheCookie(res)).toBe(true);
    const [tokenUrl, init] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect((init.body as URLSearchParams).get("code")).toBe("c");
    expect((init.body as URLSearchParams).get("code_verifier")).toBe(VERIFIER);

    // The browser no longer has the cookie: the same URL again is refused without calling Google.
    const replay = await callback(`code=c&state=${STATE}`, null);
    expect(replay.headers.get("location")).toBe(LOGIN_ERROR);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ends on the login page, not a 500, when the user cancels or Google is down", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const cancelled = await callback(`error=access_denied&state=${STATE}`);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const down = await callback(`code=c&state=${STATE}`);

    expect(cancelled.headers.get("location")).toBe(LOGIN_ERROR);
    expect(down.headers.get("location")).toBe(LOGIN_ERROR);
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/app/api/auth/google`
Expected: FAIL, `Failed to resolve import "./route"` in both files.

- [ ] **Step 4: Write `src/app/api/auth/google/start/route.ts`**

```ts
import { NextResponse } from "next/server";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  challengeFor,
  googleRedirectUri,
  randomToken,
} from "@/lib/auth/oauth";

/** 8.2: sends the browser to Google's consent screen, with a fresh state and PKCE verifier in a cookie. */
export function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // A checkout without Google keys (every teammate's) lands on the login page, not on Google's error page.
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=oauth", process.env.APP_URL));
  }

  const state = randomToken();
  const verifier = randomToken();
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challengeFor(verifier),
    code_challenge_method: "S256",
  }).toString();

  const res = NextResponse.redirect(google);
  // base64url has no ".", so the callback splits on it.
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: true,
    // lax, not strict: Google's redirect back is a cross-site navigation, which strict would strip the cookie from.
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
```

- [ ] **Step 5: Write `src/app/api/auth/google/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  googleProfileSchema,
  googleRedirectUri,
  resolveGoogleUser,
} from "@/lib/auth/oauth";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const tokenSchema = z.object({ access_token: z.string().min(1) });

/** Every answer clears the cookie, so each state and verifier works once (C7). */
function finish(path: string) {
  const res = NextResponse.redirect(new URL(path, process.env.APP_URL));
  res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}
// One message for every failure; Google's own text is never shown.
const failed = () => finish("/login?error=oauth");

/** 8.3: Google sends the browser back here with ?code&state, or ?error&state when the user cancelled. */
export async function GET(request: NextRequest) {
  const [state, verifier] = request.cookies.get(OAUTH_COOKIE)?.value.split(".") ?? [];
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !verifier || !code || request.nextUrl.searchParams.get("state") !== state) {
    return failed();
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: googleRedirectUri(),
      }),
    });
    if (!tokenRes.ok) throw new Error(`Google's token endpoint answered ${tokenRes.status}`);
    const { access_token } = tokenSchema.parse(await tokenRes.json());

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`Google's userinfo endpoint answered ${infoRes.status}`);
    const profile = googleProfileSchema.parse(await infoRes.json());

    const userId = await resolveGoogleUser(profile);
    if (!userId) return failed(); // an email Google has not verified

    // A new Session row and cookie, as a password login does (C11 rotation).
    const session = await createSession(userId);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    // Google unreachable or refusing, an answer we cannot read, a database error.
    console.error("Google sign-in failed:", error);
    return failed();
  }
  return finish("/");
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run src/app/api/auth/google`
Expected: PASS, 5 tests (2 + 3).

- [ ] **Step 7: Check a test guards the state.** Replace `request.nextUrl.searchParams.get("state") !== state` with `false`, rerun: *refuses a state that does not match its cookie* must fail. Put it back. Then replace the cookie value in `finish()`'s `res.cookies.set` with a delete of nothing (comment the line out): the two tests that check `clearsTheCookie` must fail. Put it back.

- [ ] **Step 8: The keys**

In `.env.example`, replace the four commented OAuth lines with:

```bash
# Google sign-in (phase 8): a "Web application" OAuth client in the Google Cloud console, whose
# redirect URI is APP_URL + /api/auth/google/callback. Empty = the Google button sends you back
# to the login page with an error message.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
```

and the `APP_URL` block with:

```bash
# --- App ---------------------------------------------------------------------
# The origin the browser is on. OAuth builds its redirect URI from it. Google refuses .local
# hosts: to test Google sign-in, set https://localhost here and open the app on that host.
APP_URL=https://mespapiers.local
```

In `docker-compose.yml`, under `web.environment`, after `WS_TICKET_SECRET`:

```yaml
      # OAuth (phase 8). APP_URL must be the origin the browser is on; empty Google
      # keys make the Google button go back to the login page.
      APP_URL: "${APP_URL:-https://mespapiers.local}"
      GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-}"
      GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET:-}"
```

Run: `docker compose config --quiet && echo ok`
Expected: `ok`. A changed `environment:` needs `docker compose up -d web` (a recreate); `docker restart` keeps the old values.

- [ ] **Step 9: Lint and commit (with Rasiol's go-ahead)**

```bash
npx eslint src/app/api/auth
git add src/app/api/auth/google .env.example docker-compose.yml
git commit -m "feat(auth): Google sign-in start and callback routes"
```

---

### Task 3: *Continuer avec Google* on the login and signup pages (8.5)

**Files:**
- Create: `src/components/ui/GoogleButton.tsx`
- Modify: `src/app/[locale]/dev/ui/page.tsx`, `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/signup/page.tsx`, `messages/{fr,en,es}.json`

**Interfaces:**
- Consumes: `GET /api/auth/google/start` and the `?error=oauth` contract from Task 2.
- Produces: `GoogleButton(props: AnchorHTMLAttributes<HTMLAnchorElement>)`.

No unit test: the page logic is one comparison, checked in the browser in Step 7 and B15.

- [ ] **Step 1: The keys**

`messages/fr.json`, in `auth`: `"continueWithGoogle": "Continuer avec Google"`; in `auth.errors`: `"oauthFailed": "La connexion avec Google n'a pas abouti. Réessayez."`
`messages/en.json`: `"continueWithGoogle": "Continue with Google"`, `"oauthFailed": "Signing in with Google did not work. Try again."`
`messages/es.json`: `"continueWithGoogle": "Continuar con Google"`, `"oauthFailed": "No se pudo iniciar sesión con Google. Vuelva a intentarlo."`

`schemas.test.ts` checks that `auth.errors` has the same keys in the three files.

- [ ] **Step 2: Write `src/components/ui/GoogleButton.tsx`**

```tsx
import type { AnchorHTMLAttributes } from "react";

/**
 * "Continue with Google": a link, not a <button>, because it navigates to the OAuth start route.
 * Give it a plain href (`/api/auth/google/start`): the i18n Link would prefix the locale.
 */
export function GoogleButton({ className = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={`inline-flex items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${className}`}
      {...props}
    >
      {/* Google's "G", as in its sign-in button guidelines. */}
      <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {children}
    </a>
  );
}
```

- [ ] **Step 3: The gallery entry**

In `src/app/[locale]/dev/ui/page.tsx`, add `import { GoogleButton } from "@/components/ui/GoogleButton";` with the other imports, and this section right after the *Button* section:

```tsx
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">GoogleButton</h2>
        <GoogleButton href="#">Continue with Google</GoogleButton>
      </section>
```

- [ ] **Step 4: The login page**

In `src/app/[locale]/(auth)/login/page.tsx`:

1. Imports: `import { use, useActionState, useState } from "react";` and `import { GoogleButton } from "@/components/ui/GoogleButton";`.
2. The signature and the error: replace `export default function LoginPage() {` with

```tsx
export default function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
```

and, after `const [email, setEmail] = useState("");`, add

```tsx
  // The Google callback sends every failure here as ?error=oauth (phase 8).
  const oauthFailed = use(searchParams).error === "oauth";
  const formError = state.error ? t(`errors.${state.error}`) : oauthFailed ? t("errors.oauthFailed") : null;
```

3. Replace the `{state.error ? ( … ) : null}` block with

```tsx
        {formError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        ) : null}
```

4. Between `</form>` and the `<p className="mt-6 …">` with `login.noAccount`, add

```tsx
      <GoogleButton href="/api/auth/google/start" className="mt-4 w-full">
        {t("continueWithGoogle")}
      </GoogleButton>
```

- [ ] **Step 5: The signup page**

In `src/app/[locale]/(auth)/signup/page.tsx`: add `import { GoogleButton } from "@/components/ui/GoogleButton";`, and the same three lines between `</form>` and the `signup.hasAccount` paragraph:

```tsx
      <GoogleButton href="/api/auth/google/start" className="mt-4 w-full">
        {t("continueWithGoogle")}
      </GoogleButton>
```

- [ ] **Step 6: The gates**

```bash
npm run lint
npm run i18n:check
npm run build && npm run typecheck
npx vitest run src/lib/auth/schemas.test.ts
```

Expected: lint 0/0; `i18n:check` lists only the 5 known unused keys; build and typecheck exit 0 (`PageProps<"/[locale]/login">` exists once the build has generated the route types); `schemas.test.ts` passes.

- [ ] **Step 7: Look at it** (on `https://mespapiers.local`, after `docker restart mespapiers_web` if the host `db:generate` broke the container, `CLAUDE.md` B0): `/fr/dev/ui` shows the button with a four-colour G in light and dark; `/fr/login` and `/fr/signup` show *Continuer avec Google* under the form, full width; `/fr/login?error=oauth` shows *La connexion avec Google n'a pas abouti. Réessayez.* in the alert; Tab reaches the button after *Se connecter*; no sideways scroll at 375; the console is clean.

- [ ] **Step 8: Commit (with Rasiol's go-ahead)**

```bash
git add src/components/ui/GoogleButton.tsx "src/app/[locale]/dev/ui/page.tsx" "src/app/[locale]/(auth)/login/page.tsx" "src/app/[locale]/(auth)/signup/page.tsx" messages/fr.json messages/en.json messages/es.json
git commit -m "feat(auth): Continue with Google on the login and signup pages"
```

---

### Task 4: An account with no password confirms its deletion with its email (8-B, Amir's files)

**Files:**
- Modify: `src/app/[locale]/(app)/account/data/schemas.ts`, `actions.ts`, `DeleteAccountForm.tsx`, `page.tsx`, `actions.test.ts`
- Modify: `messages/{fr,en,es}.json`

**Interfaces:**
- Consumes: `emailField` (Task 1).
- Produces: `deleteWithEmailSchema`; `DeleteAccountState.error` gains `"wrongEmail"`; `DeleteAccountForm({ hasPassword }: { hasPassword: boolean })`.

- [ ] **Step 1: Write the failing test**

In `actions.test.ts`, inside `describe("deleteAccount", …)`, after *mails and audits once when the same account is deleted twice at once*:

```ts
  it("lets an account with no password (Google sign-in) confirm with its email instead", async () => {
    const google = await prisma.user.create({
      data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Google" },
    });
    created.push(google.id);
    await signInAs(google.id);
    const typed = (email: string) => {
      const f = new FormData();
      f.set("email", email);
      return f;
    };

    await expect(deleteAccount({}, typed("someone-else@mespapiers.test"))).resolves.toEqual({
      error: "wrongEmail",
    });
    expect(await prisma.user.findUnique({ where: { id: google.id } })).not.toBeNull();

    await deleteAccount({}, typed(` ${google.email.toUpperCase()} `));
    expect(await prisma.user.findUnique({ where: { id: google.id } })).toBeNull();
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run "src/app/[locale]/(app)/account/data/actions.test.ts" -t "no password"`
Expected: FAIL, `expected { error: 'wrongPassword' } to deeply equal { error: 'wrongEmail' }` (today the action asks every account for a password).

- [ ] **Step 3: The schema**

Replace `src/app/[locale]/(app)/account/data/schemas.ts` with:

```ts
import { z } from "zod";
import { emailField } from "@/lib/auth/schemas";

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "passwordRequired").max(200, "passwordTooLong"),
});

// An account made by Google sign-in (phase 8) has no password: it confirms with its email.
export const deleteWithEmailSchema = z.object({ email: emailField });
```

- [ ] **Step 4: The action**

In `actions.ts`: import `deleteWithEmailSchema` next to `deleteAccountSchema`; widen the state to `error?: "wrongPassword" | "wrongEmail" | "lastAdmin" | "tooManyAttempts";`; and replace everything from `const parsed = deleteAccountSchema.safeParse(…)` down to and including `deleteLimiter.clearAttempts(user.id);` with:

```ts
  if (deleteLimiter.tooManyAttempts(user.id)) {
    return { error: "tooManyAttempts" };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  let confirmed: boolean;
  if (account?.passwordHash) {
    const parsed = deleteAccountSchema.safeParse({ password: formData.get("password") });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
    }
    confirmed = await verifyPassword(parsed.data.password, account.passwordHash);
  } else {
    // An account made by Google sign-in (phase 8) has no password to re-type: it types its email.
    const parsed = deleteWithEmailSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error, (i) => i.message as AuthErrorKey).fieldErrors };
    }
    confirmed = parsed.data.email === user.email;
  }
  if (!confirmed) {
    deleteLimiter.recordFailure(user.id);
    return { error: account?.passwordHash ? "wrongPassword" : "wrongEmail" };
  }
  deleteLimiter.clearAttempts(user.id);
```

The limiter check moves before the lookup, so the account's kind is read only once; the existing *locks after 6 failed attempts* test covers it.

- [ ] **Step 5: Run the file to see it pass**

Run: `npx vitest run "src/app/[locale]/(app)/account/data/actions.test.ts"`
Expected: PASS, every test (the 7 that were there, plus this one).

- [ ] **Step 6: The keys**

`messages/fr.json`, in `myData`: `"emailLabel": "Votre adresse e-mail, pour confirmer"`, `"wrongEmail": "Ce n'est pas l'adresse e-mail de ce compte."`
`messages/en.json`: `"emailLabel": "Your email address, to confirm"`, `"wrongEmail": "That is not this account's email address."`
`messages/es.json`: `"emailLabel": "Su dirección de correo electrónico, para confirmar"`, `"wrongEmail": "Esa no es la dirección de correo electrónico de esta cuenta."`

- [ ] **Step 7: The form**

In `DeleteAccountForm.tsx`: the signature becomes `export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {`; replace `const passwordError = state.fieldErrors?.password?.[0];` with

```tsx
  const fieldError = state.fieldErrors?.[hasPassword ? "password" : "email"]?.[0];
```

add `wrongEmail: t("wrongEmail"),` to `errorText`; and replace the `<Input … name="password" … />` with

```tsx
      {/* An account made by Google sign-in has no password: it confirms with its email (phase 8). */}
      {hasPassword ? (
        <Input
          label={t("passwordLabel")}
          name="password"
          type="password"
          autoComplete="current-password"
          error={fieldError && tAuth(`errors.${fieldError}`)}
        />
      ) : (
        <Input
          label={t("emailLabel")}
          name="email"
          type="email"
          autoComplete="off"
          error={fieldError && tAuth(`errors.${fieldError}`)}
        />
      )}
```

- [ ] **Step 8: The page**

In `page.tsx`: add `import { prisma } from "@/lib/db";`, add `export const dynamic = "force-dynamic";` above the component (it now queries Prisma), replace `await requireUser();` with

```tsx
  const { user } = await requireUser();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
```

and render `<DeleteAccountForm hasPassword={Boolean(account?.passwordHash)} />`.

- [ ] **Step 9: The gates**

```bash
npx eslint "src/app/[locale]/(app)/account/data"
npm run i18n:check
npm run typecheck
```

Expected: clean; the 5 known unused keys only; exit 0.

- [ ] **Step 10: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/account/data" messages/fr.json messages/en.json messages/es.json
git commit -m "fix(gdpr): an account with no password confirms its deletion with its email"
```

---

### Task 5: B15 in a real browser, and the docs

**Files:** `docs/testing-auth.md`, `CLAUDE.md`, `docs/plans/2026-09-21-rasiol-modules-roadmap.md`, `PROJECT_PLAN.md`, `handoff/WORKLOG.md`.

- [ ] **Step 1: Configure.** Task 0 Step 5 done; in `.env`: `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET=…`, `APP_URL=https://localhost`. Then `docker compose up -d web` (recreates it with the new environment). Check: `docker exec mespapiers_web printenv APP_URL` prints `https://localhost`.

- [ ] **Step 2: Write B15 in `docs/testing-auth.md`** (after B14), then run it. `<you>` is the Google address added as a test user.

```markdown
### B15. Google sign-in (phase 8)

On **https://localhost**, not mespapiers.local: Google refuses `.local` redirect hosts (phase 8 plan, decision 1). Setup: `.env` has the Google client and `APP_URL=https://localhost`, then `docker compose up -d web`. Rows 4 and 6 need DevTools → Network with *Preserve log*.

| # | Do | Expect |
|---|---|---|
| 1 | `/fr/login`, `/fr/signup`, keyboard only | *Continuer avec Google* under each form, full width, reached by Tab after the submit button |
| 2 | Click it, pick `<you>` on Google | back on `/fr`, signed in, the nav shows your Google name. `select "passwordHash", "displayName" from "User" where email = '<you>'` → `NULL`, your name; one `OAuthAccount` row, `provider = 'google'` |
| 3 | Log out, *Continuer avec Google* again | the same user; still one `User` and one `OAuthAccount` row |
| 4 | *Mes données*: the field asks for your email. Type another address, then your own | *Ce n'est pas l'adresse e-mail de ce compte.*; then the account is deleted and you are on `/fr/login` |
| 5 | `/fr/signup` with `<you>` and a password; log out; *Continuer avec Google* | signed in to that account: one `User` row, `passwordHash` not null, one `OAuthAccount` row (linked) |
| 6 | After a sign-in, copy the `/api/auth/google/callback?...` URL from Network; log out; open it | `/fr/login` with *La connexion avec Google n'a pas abouti. Réessayez.* (the cookie is gone; Google also refuses a used code) |
| 7 | On Google's screen, cancel | `/fr/login` with the same message |
| 8 | Start on `https://mespapiers.local/fr/login` | Google, then back on `https://localhost/fr/login` with the message: the state cookie stayed on mespapiers.local. Expected |
| 9 | `/en/login`, `/es/login` | *Continue with Google*, *Continuar con Google* |
| 10 | 375 / 768 / 1440 on `/fr/login?error=oauth` | no sideways scroll; the console stays clean |
| 11 | Empty `GOOGLE_CLIENT_ID` in `.env`, `docker compose up -d web`, click the button | `/fr/login` with the message, Google is never shown. Put the key back |

Afterwards: delete `<you>` on *Mes données*, set `APP_URL=https://mespapiers.local` back if you test anything else, and `docker compose up -d web`.
```

Expected: every row as written. A row that differs is a bug: stop, fix it with a failing test first where one can be written, and rerun the row.

- [ ] **Step 3: The A1 table and counts in `docs/testing-auth.md`.** Add `src/app/api/auth` to the auth command's path list; the count becomes **273 passed (27 files)**, the auth and profile part **16 files and 126 tests**; add rows for `oauth.test.ts`, `api/auth/google/start/route.test.ts` and `api/auth/google/callback/route.test.ts` (what each proves, from this plan's *Testing* table).

- [ ] **Step 4: The full gates**

```bash
npx vitest run --maxWorkers=1
npm run lint
npm run i18n:check
npm run build && npm run typecheck
```

Expected: `273 passed (273)`, lint 0/0, the 5 known unused keys, exit 0.

- [ ] **Step 5: The docs.** `CLAUDE.md`: OAuth leaves *What does not exist*; a bullet for `src/lib/auth/oauth.ts` and the two routes in *What exists* (and `/api/auth/google/{start,callback}` in the API route list); `GoogleButton` in *UI conventions*' primitives; the *Gotchas* line on Google's redirect host points at decision 1; phase 8's status. The roadmap: phase 8's *As built* (commits, gates, departures from the table: decisions 5–7). `PROJECT_PLAN.md`: row C (C7 in an open PR). `handoff/WORKLOG.md`: an entry.

- [ ] **Step 6: Commit (with Rasiol's go-ahead)**

```bash
git add docs/testing-auth.md CLAUDE.md docs/plans/2026-09-21-rasiol-modules-roadmap.md PROJECT_PLAN.md handoff/WORKLOG.md
git commit -m "docs: phase 8, B15"
```

---

### Task 6: Final review and the PR

- [ ] **Step 1: Whole-branch review.** Use `superpowers:requesting-code-review`: one fresh reviewer, read-only, on `main..feat/oauth-google`, with this plan as the spec. Fix each Critical or Important finding with a failing test first; record the Minor ones in the worklog.

- [ ] **Step 2: Push and open the PR** (with Rasiol's go-ahead; `gh auth login` first, it has been logged out since 2026-10-14)

```bash
git push -u origin feat/oauth-google
gh pr create --base main --title "feat(auth): sign in with Google, OAuth 2.0 + PKCE (phase 8)" --body-file <(cat <<'EOF'
Phase 8 of the roadmap (C7): the OAuth 2.0 minor, Google first.

- `GET /api/auth/google/start` and `/callback`: authorization code + PKCE (S256), hand-written with `fetch`; `state` and the verifier live in one httpOnly 10-minute cookie that every callback answer clears, so a replayed callback is refused
- account resolution: the same Google identity signs in again; a verified email that already has an account is linked to it; otherwise a new account with no password. An unverified Google email is refused
- *Continuer avec Google* on the login and signup pages (`GoogleButton`, in the /dev/ui gallery)

Plan: docs/plans/2026-10-26-c7-oauth-google.md · Manual test: docs/testing-auth.md B15

To try it: Google refuses `.local` redirect URIs, so Google sign-in runs on https://localhost (set `APP_URL=https://localhost` and the Google keys in `.env`, then `docker compose up -d web`). Without the keys, the button sends you back to the login page with a message.

@Amir: `account/data/` (schemas, action, form, page): an account created by Google has no password, so it confirms its deletion by typing its email; one test in `actions.test.ts`.
@Alexandre: the `GoogleButton` primitive in `src/components/ui/` and its gallery entry.
@Adrien: `docker-compose.yml` forwards `APP_URL`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `web`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

- [ ] **Step 3: Update the worklog** with the PR number, and stop.
