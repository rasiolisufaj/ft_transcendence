# Rasiol's Four Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Rasiol's four graded modules — standard user management & auth, advanced permissions, organizations (channels), OAuth 2.0 and TOTP 2FA — in the order the current codebase actually permits, unblocking three teammates as early as possible.

**Architecture:** Database-backed opaque sessions (random token in an httpOnly cookie, only its SHA-256 stored), one synchronous default-deny `can()` policy function resolving three tiers (global admin → channel moderator → resource owner), and Server Actions that each call `requireUser()` then `assertCan()`. No middleware, no auth library, no service layer — plain functions in `src/lib/auth/`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Prisma 6 (generator `prisma-client` → `src/generated/prisma/`) · PostgreSQL 17 · Vitest 5 · Zod 4 · `@node-rs/argon2` · `otpauth` · `node:crypto`

**Spec:** [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) §0 (constraints), §4 (file ownership), §5 (published interfaces), §7 Domain C + E9–E11 (WBS), §9 (dependencies) · [`subject_requirements.md`](../../subject_requirements.md)

**Supersedes:** `docs/plans/2026-09-17-c1-auth-contract-and-session-core.md`. That file is **gone** — `docs/` is untracked (`CLAUDE.md` flags this), so the 2026-09-21 rewrite existed only on one machine and was lost. Its two recorded decisions are carried forward verbatim in §C below. Update `CLAUDE.md` to point at *this* file.

---

## Global Constraints

Copied from `PROJECT_PLAN.md` §0. Every task's definition of done implicitly includes this section.

- Node **22 LTS or newer** (this machine: v24.14.1), TypeScript **5.x**, `strict: true`, `noUncheckedIndexedAccess` — indexed access returns `T | undefined`.
- Next.js **16** App Router, React **19**, PostgreSQL **17**. Read `node_modules/next/dist/docs/` before writing App Router code; Next 16 breaks most training data.
- One `package.json`, one lockfile, **npm**.
- Import Prisma from `@/generated/prisma/client`, **never** `@prisma/client`. Use the singleton exported from [`src/lib/db.ts`](../../src/lib/db.ts).
- Every form is validated by **one Zod schema module imported by both the client component and the server action**. Two schemas that "match" is a defect.
- Secrets live only in `.env` (git-ignored). `.env.example` lists every key with a dummy value; uncomment a planned key in the same PR that introduces its service.
- Timestamps stored in UTC, rendered in `Europe/Paris`. Every Prisma model carries `createdAt` and `updatedAt`.
- Conventional Commits (`feat(auth): …`). No direct pushes to `main`; `feat/*` branch → PR → one approving review. Zero ESLint warnings.
- Zero warnings and zero errors in the Chrome console on every route. Responsive and keyboard-navigable at **375 / 768 / 1440**.
- Pages that query Prisma at request time set `export const dynamic = "force-dynamic"`.
- New UI primitives go in `src/components/ui/` **and** into the gallery at [`/dev/ui`](../../src/app/dev/ui/page.tsx).

---

## A. Dependency analysis — why this order

### What exists today

Nothing of auth. `prisma/schema.prisma` has the **tables** (`Session`, `OAuthAccount`, `AuditLog`, `User.passwordHash`/`totpSecret`/`totpEnabled`/`globalRole`/`reputation`, `Channel`, `ChannelMember`, `Thread`, `Answer`, `Vote`) applied by migration `20260918122806_init`. There is no `src/lib/auth/`, no test runner, and `zod` is only a transitive dependency. `uploadDocument` in [`src/app/documents/new/actions.ts`](../../src/app/documents/new/actions.ts) has **no auth at all** — it attaches every upload to the first `User` in the table.

### The blocking dependencies, in order

| # | Piece | Blocks | Why it is foundational |
|---|---|---|---|
| 1 | **Vitest + `zod` + `@node-rs/argon2` installed** | every task below | Every "Done when" in Domain C is a test. There is no runner. |
| 2 | **`session.ts` — `createSession` / `validateSessionToken` / `requireUser`** | **everything, and 3 teammates** | `requireUser()` is the first line of every guarded action, route handler and layout. Amir needs it for `/api/documents/[id]/file`, Alexandre for the WS ticket, Adrien for the assistant context guard. Nothing else can start. |
| 3 | **Login / signup + the `(app)` guard** | phases 3–11 | You cannot test "different views per role" until you can log in as two different roles. |
| 4 | **`policy.ts` — `can()` / `assertCan()`** | module 1, module 2, and 3 teammates | Amir scopes community queries with it, Alexandre authorises WS topics with it, Adrien gates assistant context with it. §9 lists it as a cross-team blocker. |
| 5 | **`writeAudit()`** | module 1's admin surface, module 2's moderation | C14 and E11 both have "writes an `AuditLog` row" in their Done-when. |
| 6 | **Channels + membership** | the channel-MODERATOR tier of `can()` becoming *demonstrable*, and Alexandre's two-browser milestone | `can()` can be unit-tested against a fabricated context before channels exist — but the graded "different actions per role" demo needs real channels. §9: "Channels + membership (E9) blocks the W2 two-browser milestone." |

### Module order

```
Phase 0  tooling ────────────────────────────────────────── gate for everything
   │
Phase 1  session core (C1) ──────────── unblocks Amir, Alexandre, Adrien
   │
Phase 2  login / signup / guard (C2, C3, C11p, C12) ─┬─────────────────┐
   │                                                  │                 │
Phase 3  can() + audit (C4, C6) ← 3 teammates wait    │                 │
   │                                                  │                 │
Phase 4  admin surface (C14a)      MODULE 1 done*     │                 │
   │                                                  │                 │
Phase 5  channels (E9) ← Alexandre's demo waits       │                 │
Phase 6  threads/answers/votes (E10)                  │                 │
Phase 7  moderation (E11) + channel roles (C14b)      │                 │
         MODULE 1 + MODULE 2 done                     │                 │
                                            Phase 8  OAuth Google (C7)  │
                                            Phase 9  OAuth GitHub (C8)  │
                                                     MODULE 3 done      │
                                                              Phase 10  TOTP (C9)
                                                              Phase 11  step-up (C10)
                                                                        MODULE 4 done
```

**The load-bearing observation:** phases 8–11 depend only on phase 2. They are your **slack**. Phases 0–4 are the critical path for three other people, and phases 5–7 are the critical path for Alexandre's real-time demo. Do not start OAuth before phase 7 is green, however tempting — and if week 4 runs long, OAuth and 2FA are 2 of your 6 module points, while permissions and organizations are 4.

**Module 1 is "done\*" at phase 4** only for the global-role half (admin/user). Its channel-scoped MODERATOR half lands in phase 7, because that is where there is a channel to moderate.

---

## B. Teammate dependencies

### What you owe them (and when it stops hurting)

| Deliverable | Phase | Who is blocked | Note |
|---|---|---|---|
| `requireUser()` / `getCurrentUser()` | 1 | Amir (E6 file route), Adrien (B10 assistant guard), Alexandre (every page) | §9 calls this a W1 D1 blocker. It is the single most urgent thing in this document. |
| `can()` / `assertCan()` | 3 | Amir (community scoping), Alexandre (WS topic authz), Adrien (assistant context) | Publish `policy.ts` with the `Action` union and a **default-deny stub** the moment phase 3 starts, so they can type against it. |
| WS ticket + `verifyTicket()` | 2 (task 2.5) | Alexandre (D2 handshake) | §9: "small and isolated — pull it forward if the session core runs late". Do it the day Alexandre starts D2. |
| Channels + membership | 5 | Alexandre (two-browser milestone) | Until then his demo runs off `prisma/seed.ts`'s single channel. |

### What you need from them

| Need | Owner | Blocks | Fallback if it is late |
|---|---|---|---|
| `components/ui` primitives (Button, Card, Badge, Input, Dialog, Table, EmptyState) | Alexandre (D0) | **Already done** — they exist in `src/components/ui/` | — |
| `app/[locale]/` + `next-intl` (D10, D11) | Alexandre | nothing, by decision §C-2 | You build flat routes with English strings now; one `git mv` migrates them later. |
| `Document.version`, `DocumentCategory` enum | Amir | nothing of yours | Your document guards only need `ownerId`, which exists. |
| Redis | Adrien | nothing of yours | The login rate limiter and the WS ticket nonce set are in-process Maps. One `web` container; that is sufficient and honest. |

### ⚠️ Ownership conflict to settle at standup — raise this before phase 5

`PROJECT_PLAN.md` §6 assigns **"Organization system (community channels)" to Amir**, and §7 assigns **E9 (channels), E10 (threads/answers/votes) and E11 (moderation) to Amir**. Your module list claims all three. The 2026-09-21 roadmap also had you doing channels/moderation at phase 5, so the team has evidently already moved it — but it is **not written down anywhere Amir can see**, because `docs/` is untracked.

Two consequences if you keep it:

1. **Capacity.** §7 budgets Domain C at 15 days. E9+E10+E11 add 4 days, putting you near 19 against a 25-day allowance, with PM duties on top. §7 already names Alexandre as "the tightest" at 19 — you would join him there.
2. **`src/lib/community/` is Amir's directory** in §4, and §4's rule is one owner per directory who reviews every edit in it. Either the ownership row moves to you, or every phase 5–7 PR needs Amir's review.

**Action:** get this into `MEETING_DISCUSSION.md` with a date before writing a line of phase 5.

---

## C. Recorded departures from `PROJECT_PLAN.md`

Each one is a deliberate, reversible choice. Read them out at evaluation rather than letting them look like gaps.

1. **`GlobalRole` stays `USER | ADMIN`. `MODERATOR` is not added.** *(carried forward from the lost 2026-09-21 doc)* Moderator is a `ChannelRole`, scoped to exactly one channel. A global `MODERATOR` would contradict §5's "a `MODERATOR` membership on `resource.channelId` grants … **inside that channel only**". **No schema change.**

2. **The admin route renders its 403 from `layout.tsx` instead of throwing.** *(carried forward)* `error.tsx` does not wrap the `layout.tsx` in its own segment, so a `throw` in the layout escapes to the root error boundary and the user sees a blank page — which C14's Done-when explicitly forbids ("a non-admin hitting the admin route gets 403, **not a blank page**"). Next 16's `forbidden()` would be the idiomatic answer, but it requires `experimental.authInterrupts` (confirmed in `node_modules/next/dist/docs/.../forbidden.md`), and the project does not enable experimental flags.

3. **Routes are flat now (`/login`, `/admin/users`, `/channels`) with English strings, migrated under `app/[locale]/` when Alexandre ships D10/D11.** §0 says every user-visible string resolves through `next-intl`. It does not exist yet, and waiting for it would idle you *and* the three people blocked on your session core. The migration is a `git mv` of the route tree plus a string-extraction pass. **Do not let this slip past week 4** — §9 warns that retrofitting `[locale]` during the freeze touches every page.

4. **No `middleware.ts` / `proxy.ts`.** §7 C3 says "route middleware". Next 16 renamed middleware to `proxy.ts`, and its own authentication guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) does not use it for auth at all — it documents proxy checks as *optimistic only*, explicitly warning against database reads there because it runs on every prefetch. The real boundary is `requireUser()` in the segment layout plus `requireUser()` + `assertCan()` inside every Server Action, which is both simpler and stricter. Render-time gating is not a security boundary; the action check is.

5. **CSRF is Next.js's built-in Server Action Origin/Host check — no token implementation.** §7 C11 asks for CSRF. `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:82` documents it: "The request's `Origin` is compared to the `Host` (or `X-Forwarded-Host`). Mismatches are rejected." `infra/nginx/nginx.conf:66` sets `proxy_set_header Host $host`, so `Origin: https://mespapiers.local` matches `Host: mespapiers.local` and **no `serverActions.allowedOrigins` entry is needed**. Hand-rolling a second CSRF layer on top would be exactly the overengineering this plan avoids. Verify it once in phase 2 with a curl that sends a wrong Origin.

6. **`SessionContext` gains a `memberships` field.** §5 publishes `can()` as **synchronous**, and the channel-MODERATOR tier must know the caller's role in `resource.channelId`. A sync function cannot query. So `validateSessionToken()` loads memberships alongside the user (one `include`, one query) and `can()` reads them from the context. This is **additive** to the published interface — no existing field changes — but announce it at standup per §5.

7. **`SessionUser.locale` is typed `string`, not `Locale`.** `Locale` is exported from `src/i18n/config.ts`, which is Alexandre's D10 and does not exist; `User.locale` is `String @default("fr")` in the schema. Becomes `Locale` in the same PR that lands D10.

8. **`Resource.channelId` is `number`, not `string`.** §5 types it `string | null`; `Channel.id` is `Int @id @default(autoincrement())`. The schema wins. Note the matching wart: `AuditLog.channelId` **is** `String?`, so `writeAudit()` stringifies. Do not "fix" either — a migration to align them buys nothing.

9. **Tests run against the dev database, not a separate test database.** Every DB test creates users with a `randomUUID()` email and deletes them in `afterEach`; `onDelete: Cascade` cleans up sessions and audit rows. A second database plus its migration lifecycle is infrastructure this project does not need.

10. **Password hashing is `@node-rs/argon2`** — matching §2's table verbatim (Argon2id, prebuilt binaries, no node-gyp). Confirmed available at `2.2.1`.

---

## D. File structure

Everything below is yours per §4 unless marked. **Files that change together live together**; each file has one responsibility.

```text
vitest.config.ts                          P0   test runner + @ alias
vitest.setup.ts                           P0   loads .env for DATABASE_URL

src/lib/auth/
├─ password.ts                            P1   hashPassword / verifyPassword
├─ session.ts                             P1   §5's published interface, in full
├─ schemas.ts                             P2   THE Zod module for signup + login
├─ ticket.ts                              P2   WS ticket mint/verify (C12, Alexandre)
├─ totp.ts                                P10  secret, URI, verify, recovery codes
└─ oauth/
   ├─ pkce.ts                             P8   verifier + challenge + state
   └─ providers.ts                        P8/9 Google and GitHub as two config objects

src/lib/audit.ts                          P3   writeAudit()
src/lib/auth/policy.ts                    P3   Action union, can(), assertCan()

src/lib/community/                        ⚠ Amir's directory per §4 — see §B
├─ channels.ts                            P5
├─ threads.ts                             P6
└─ moderation.ts                          P7

src/app/
├─ (auth)/login/{page.tsx,actions.ts}     P2
├─ (auth)/signup/{page.tsx,actions.ts}    P2
├─ (auth)/logout/actions.ts               P2
├─ (app)/layout.tsx                       P2   requireUser() — THE route guard
├─ (app)/page.tsx                         P2   moved from src/app/page.tsx   ⚠ shared file
├─ (app)/documents/                       P2   moved                         ⚠ Amir's
├─ admin/layout.tsx                       P4   403 render, not throw (§C-2)
├─ admin/users/{page.tsx,actions.ts}      P4
├─ channels/                              P5-7
└─ api/auth/
   ├─ ws-ticket/route.ts                  P2
   ├─ google/{start,callback}/route.ts    P8
   └─ github/{start,callback}/route.ts    P9
```

Two schema migrations in the whole plan: one in **phase 7** (moderation columns), one in **phase 10** (2FA columns). Phases 0–6 need none — the schema already has what they use. `prisma/` is Amir's directory; both migrations need his review.

---

## Phase 0 — Tooling gate

**Est:** 0.5d · **Entry gate:** none · **Exit gate for phase 1:** `npm test` runs and passes; `npm run lint` and `npm run build` are clean.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/lib/auth/password.test.ts`
- Create: `src/lib/auth/password.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, storedHash: string): Promise<boolean>` from `@/lib/auth/password`.

### Task 0.1: Regenerate the Prisma client and commit `docs/`

The checked-out `src/generated/prisma/` is **stale**: `enums.ts` says *"This file is empty because there are no enums in the schema"* and `models/` holds only `Document.ts` and `User.ts`, while the schema has 16 models and 4 enums. Every import of `GlobalRole` or `ChannelRole` fails until this is fixed.

- [ ] **Step 1: Regenerate**

```bash
sudo chown -R $USER:$USER src/generated   # only if a container has run since your last generate
npm run db:generate
grep -c "GlobalRole\|ChannelRole" src/generated/prisma/enums.ts
```

Expected: a non-zero count. If it prints `0`, the generate did not pick up the schema — check `DATABASE_URL` in `.env` and re-run.

- [ ] **Step 2: Put `docs/` under version control**

`CLAUDE.md` records that `docs/`, `MEETING_DISCUSSION.md` and `CLAUDE.md` are untracked, which is how the previous version of this plan was lost. Fix it now, before it happens twice.

```bash
git add docs/ MEETING_DISCUSSION.md CLAUDE.md
git commit -m "docs: track project plans, meeting notes and agent guidance"
```

### Task 0.2: Install the dependencies

- [ ] **Step 1: Install**

```bash
npm install zod@^4.5.4 @node-rs/argon2@^2.2.1
npm install -D vitest@^5.0.1
```

`zod` currently resolves only as a transitive dependency of `eslint-plugin-react-hooks`. It must be a direct dependency before anything imports it. Note it is the **v4 API** — `z.email()`, not `z.string().email()`.

- [ ] **Step 2: Add the test scripts to `package.json`**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### Task 0.3: Configure Vitest

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // DB tests share one Postgres; running files in parallel makes cleanup racy.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
// Prisma needs DATABASE_URL. next dev loads .env itself; Vitest does not.
import "dotenv/config";
```

### Task 0.4: Password hashing (TDD)

- [ ] **Step 1: Write the failing test** — `src/lib/auth/password.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("does not store the plaintext", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored).not.toContain("correct horse battery staple");
    expect(stored.startsWith("$argon2id$")).toBe(true);
  });

  it("salts: the same password hashes differently every time", async () => {
    const a = await hashPassword("hunter2hunter2");
    const b = await hashPassword("hunter2hunter2");
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("hunter2hunter2");
    expect(await verifyPassword("hunter2hunter2", stored)).toBe(true);
    expect(await verifyPassword("hunter2hunter3", stored)).toBe(false);
  });

  it("returns false instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- password
```

Expected: FAIL — `Failed to resolve import "@/lib/auth/password"`.

- [ ] **Step 3: Write the implementation** — `src/lib/auth/password.ts`

```ts
import { hash, verify } from "@node-rs/argon2";

/** Argon2id with the library defaults (§PROJECT_PLAN §2). The salt is generated
 *  per call and embedded in the returned string, so no separate salt column. */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    // Malformed or truncated hash — treat as a failed login, never a 500.
    return false;
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npm test
```

Expected: 4 passed.

- [ ] **Step 5: Verify the whole toolchain is still clean**

```bash
npm run lint && npm run build && npm run typecheck
```

Expected: no warnings, no errors. (`npm run build` must precede `typecheck` — `next build` generates the route types the root layout uses.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/lib/auth/password.ts src/lib/auth/password.test.ts
git commit -m "chore(auth): add vitest, zod and argon2; hash passwords with argon2id"
```

---

## Phase 1 — Session core (C1)

**Est:** 2d · **Entry gate:** phase 0 exit gate green.
**Exit gate for phase 2:** all session tests pass, including the one asserting the raw token appears in no column. **Tell the team at standup that `requireUser()` exists** — three people are waiting on it.

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `GlobalRole`, `ChannelRole` from `@/generated/prisma/client`.
- Produces — this is §5's published interface, plus the `memberships` field from §C-6:

```ts
export type SessionUser = {
  id: string; email: string; displayName: string;
  avatarKey: string | null; locale: string; totpEnabled: boolean;
  globalRole: GlobalRole; reputation: number;
};
export type SessionContext = {
  session: { id: string; expiresAt: Date; twoFactorVerified: boolean };
  user: SessionUser;
  memberships: { channelId: number; role: ChannelRole }[];
};
export const SESSION_COOKIE = "mp_session";
export function generateSessionToken(): string;
export function hashToken(token: string): string;
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }>;
export async function validateSessionToken(token: string): Promise<SessionContext | null>;
export async function invalidateSession(sessionId: string): Promise<void>;
export async function invalidateAllSessions(userId: string): Promise<void>;
export async function getCurrentUser(): Promise<SessionContext | null>;
export async function requireUser(): Promise<SessionContext>;
```

**Why `Session.id` needs no migration:** it is already `String @id`. Storing `SHA-256(token)` in it satisfies §3's requirement that the raw token appear in no column, with zero schema change.

### Task 1.1: Token generation and hashing (TDD)

- [ ] **Step 1: Write the failing test** — `src/lib/auth/session.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { generateSessionToken, hashToken } from "@/lib/auth/session";

describe("session tokens", () => {
  it("generates a URL-safe token with at least 128 bits of entropy", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(22);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, generateSessionToken));
    expect(seen.size).toBe(500);
  });

  it("hashes deterministically to 64 hex chars", () => {
    const token = generateSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- session
```

Expected: FAIL — `Failed to resolve import "@/lib/auth/session"`.

- [ ] **Step 3: Write the two functions** — `src/lib/auth/session.ts`

```ts
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "mp_session";

/** 192 bits, base64url so it is safe in a cookie with no encoding. */
export function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The token the browser holds is never stored. Only this digest is, as Session.id. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

- [ ] **Step 4: Run and watch them pass**

```bash
npm test -- session
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): generate opaque session tokens and store only their sha-256"
```

### Task 1.2: Create, validate, invalidate (TDD)

- [ ] **Step 1: Add the failing tests** — append to `src/lib/auth/session.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createSession,
  hashToken,
  invalidateAllSessions,
  invalidateSession,
  validateSessionToken,
} from "@/lib/auth/session";

describe("session lifecycle", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test" },
    });
    userId = user.id;
  });

  // Session, ChannelMember and AuditLog all cascade from User.
  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("stores the raw token in no column", async () => {
    const { token } = await createSession(userId);
    const row = await prisma.session.findFirst({ where: { userId } });
    expect(row).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row!.id).toBe(hashToken(token));
  });

  it("validates a fresh token into a full context", async () => {
    const { token } = await createSession(userId);
    const ctx = await validateSessionToken(token);
    expect(ctx?.user.id).toBe(userId);
    expect(ctx?.user.globalRole).toBe("USER");
    expect(ctx?.session.twoFactorVerified).toBe(false);
    expect(ctx?.memberships).toEqual([]);
  });

  it("rejects a token that was never issued", async () => {
    expect(await validateSessionToken("not-a-real-token")).toBeNull();
  });

  it("rejects an expired session and deletes the row", async () => {
    const { token } = await createSession(userId);
    await prisma.session.update({
      where: { id: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).toBeNull();
  });

  it("slides the expiry when the session is past its halfway point", async () => {
    const { token } = await createSession(userId);
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day left of 30
    await prisma.session.update({ where: { id: hashToken(token) }, data: { expiresAt: soon } });

    const ctx = await validateSessionToken(token);
    expect(ctx!.session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
  });

  it("invalidates one session and leaves the others alone", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    await invalidateSession(hashToken(a.token));
    expect(await validateSessionToken(a.token)).toBeNull();
    expect(await validateSessionToken(b.token)).not.toBeNull();
  });

  it("invalidates every session of one user", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    await invalidateAllSessions(userId);
    expect(await validateSessionToken(a.token)).toBeNull();
    expect(await validateSessionToken(b.token)).toBeNull();
  });

  it("carries channel memberships into the context", async () => {
    const channel = await prisma.channel.create({
      data: { title: "Test channel", createdBy: userId },
    });
    await prisma.channelMember.create({
      data: { channelId: channel.id, userId, role: "MODERATOR" },
    });
    const { token } = await createSession(userId);
    const ctx = await validateSessionToken(token);
    expect(ctx?.memberships).toEqual([{ channelId: channel.id, role: "MODERATOR" }]);
    await prisma.channel.delete({ where: { id: channel.id } });
  });
});
```

- [ ] **Step 2: Run and watch them fail**

```bash
npm test -- session
```

Expected: FAIL — `createSession is not a function`. If instead it fails with `Environment variable not found: DATABASE_URL`, `vitest.setup.ts` is not loading — check `setupFiles` in `vitest.config.ts` and that `.env` exists (`cp .env.example .env`).

- [ ] **Step 3: Implement** — the imports go at the top of `src/lib/auth/session.ts`, above the two functions from task 1.1; everything after them goes below.

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { ChannelRole, GlobalRole } from "@/generated/prisma/client";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;      // 30 days
const RENEW_WHEN_LESS_THAN_MS = SESSION_TTL_MS / 2;   // slide past the halfway point

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarKey: string | null;
  locale: string;          // becomes Locale when Alexandre ships D10 — §C-7
  totpEnabled: boolean;
  globalRole: GlobalRole;
  reputation: number;
};

export type SessionContext = {
  session: { id: string; expiresAt: Date; twoFactorVerified: boolean };
  user: SessionUser;
  /** Loaded here because can() is synchronous and cannot query — §C-6. */
  memberships: { channelId: number; role: ChannelRole }[];
};

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string): Promise<SessionContext | null> {
  const id = hashToken(token);
  const row = await prisma.session.findUnique({
    where: { id },
    include: {
      user: {
        include: { channelMemberships: { select: { channelId: true, role: true } } },
      },
    },
  });
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  let { expiresAt } = row;
  if (expiresAt.getTime() - Date.now() < RENEW_WHEN_LESS_THAN_MS) {
    expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({ where: { id }, data: { expiresAt } });
  }

  const { user } = row;
  return {
    session: { id: row.id, expiresAt, twoFactorVerified: row.twoFactorVerified },
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarKey: user.avatarKey,
      locale: user.locale,
      totpEnabled: user.totpEnabled,
      globalRole: user.globalRole,
      reputation: user.reputation,
    },
    memberships: user.channelMemberships,
  };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
```

- [ ] **Step 4: Run and watch them pass**

```bash
npm test -- session
```

Expected: 11 passed. Note `deleteMany` rather than `delete` in the invalidators — `delete` throws on a missing row, and logging out twice must not be a 500.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): create, validate, slide and invalidate database sessions"
```

### Task 1.3: Cookie reading — `getCurrentUser` and `requireUser`

These two call `cookies()` and `redirect()`, which only work inside a request. They are covered by the phase 2 end-to-end walkthrough, not by a unit test — writing a fake request context to unit-test a four-line function is the kind of thing this plan avoids.

- [ ] **Step 1: Implement** — append to `src/lib/auth/session.ts`

```ts
/** Reads the session cookie. Returns null when absent or invalid. */
export async function getCurrentUser(): Promise<SessionContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

/** The guard. Redirects to /login when there is no valid session. */
export async function requireUser(): Promise<SessionContext> {
  const ctx = await getCurrentUser();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
```

`cookies()` is **async** in Next 16 — confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`. `sameSite: "lax"` (not `strict`) so the OAuth callback redirect in phase 8 still carries the cookie. `secure` is off in development because `npm run dev` on `localhost:3000` is plain HTTP; behind nginx in production it is on.

- [ ] **Step 2: Verify it compiles and lints**

```bash
npm run lint && npm run build && npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): read the session cookie with getCurrentUser and requireUser"
```

- [ ] **Step 4: Announce it**

Post in the team channel: `requireUser()` and `getCurrentUser()` are on `main`, importable from `@/lib/auth/session`. §9 lists this as the W1 D1 blocker for Amir, Alexandre and Adrien. Include the `SessionContext` shape so they can type against it.

---

## Phase 2 — Signup, login, logout, route guard (C2, C3, C11 partial, C12)

**Est:** 1.5d · **Entry gate:** phase 1 exit gate green.
**Exit gate for phase 3:** sign up → log out → log in → reach `/` works in a browser; an unauthenticated request to `/` lands on `/login`; `uploadDocument` no longer invents a demo user; the WS ticket route returns a ticket.

**Files:**
- Create: `src/lib/auth/schemas.ts`, `src/lib/auth/schemas.test.ts`
- Create: `src/app/(auth)/signup/{page.tsx,actions.ts}`, `src/app/(auth)/login/{page.tsx,actions.ts}`, `src/app/(auth)/logout/actions.ts`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/lib/auth/ticket.ts`, `src/lib/auth/ticket.test.ts`, `src/app/api/auth/ws-ticket/route.ts`
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`; `src/app/documents/` → `src/app/(app)/documents/`  ⚠ shared/Amir's files
- Modify: `src/app/(app)/documents/new/actions.ts` — replace the demo-user hack with `requireUser()`  ⚠ Amir's file
- Modify: `src/app/layout.tsx` — nav shows the signed-in user and a logout button

**Interfaces:**
- Consumes: everything from phase 1.
- Produces: `signupSchema`, `loginSchema`, `SignupInput`, `LoginInput` and `AuthFormState` (`{ error?: string; fieldErrors?: Record<string, string[] | undefined> }`, the shape every auth action returns to `useActionState`) from `@/lib/auth/schemas`; `mintTicket(userId: string): string` and `verifyTicket(ticket: string): { userId: string } | null` from `@/lib/auth/ticket`.

### Task 2.1: The shared Zod module (TDD)

§0's rule — **one schema module imported by both the client component and the server action** — is a review failure if broken, and C2's Done-when is a test that proves it. This file is that proof.

- [ ] **Step 1: Write the failing test** — `src/lib/auth/schemas.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";

describe("signupSchema", () => {
  it("accepts a well-formed signup", () => {
    const r = signupSchema.safeParse({
      email: "  Rasiol@Example.COM ",
      displayName: "  Rasiol  ",
      password: "hunter2hunter2",
    });
    expect(r.success).toBe(true);
    // Normalised so "A@b.com" and "a@b.com" cannot become two accounts.
    expect(r.data?.email).toBe("rasiol@example.com");
    expect(r.data?.displayName).toBe("Rasiol");
  });

  it("rejects a malformed email", () => {
    expect(signupSchema.safeParse({
      email: "nope", displayName: "Rasiol", password: "hunter2hunter2",
    }).success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const r = signupSchema.safeParse({
      email: "a@b.com", displayName: "Rasiol", password: "short",
    });
    expect(r.success).toBe(false);
    const issue = r.error?.issues.find((i) => i.path[0] === "password");
    expect(issue?.message).toContain("8");
  });

  it("rejects a display name under 2 characters", () => {
    expect(signupSchema.safeParse({
      email: "a@b.com", displayName: "R", password: "hunter2hunter2",
    }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not impose the signup password rules on login", () => {
    // An account created before a rule change must still be able to log in.
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npm test -- schemas
```

Expected: FAIL — `Failed to resolve import "@/lib/auth/schemas"`.

- [ ] **Step 3: Implement** — `src/lib/auth/schemas.ts`

```ts
import { z } from "zod";

/**
 * Normalise BEFORE validating. Zod applies .trim()/.toLowerCase() as transforms
 * that run *after* the check they are chained onto, so `z.email().trim()` rejects
 * "  A@B.com " before the trim ever happens. Hence string → normalise → pipe.
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter a valid email address." }));

// Zod 4 API: top-level z.email(), and { error: ... } for the message.
export const signupSchema = z.object({
  email: emailField,
  displayName: z.string()
    .trim()
    .min(2, { error: "Your display name needs at least 2 characters." })
    .max(50, { error: "Your display name cannot exceed 50 characters." }),
  password: z.string()
    .min(8, { error: "Your password needs at least 8 characters." })
    .max(200, { error: "Your password cannot exceed 200 characters." }),
});
export type SignupInput = z.infer<typeof signupSchema>;

// Deliberately looser than signupSchema: login validates identity, not policy.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, { error: "Enter your password." }),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * The shape every auth Server Action returns to useActionState. It lives here,
 * not in an action file: a "use server" module may only export async functions.
 */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
```

- [ ] **Step 4: Run and watch it pass**

```bash
npm test -- schemas
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/schemas.ts src/lib/auth/schemas.test.ts
git commit -m "feat(auth): add the shared zod schemas for signup and login"
```

### Task 2.2: Signup and login actions

- [ ] **Step 1: Write the signup action** — `src/app/(auth)/signup/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signupSchema, type AuthFormState } from "@/lib/auth/schemas";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function signup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { email, displayName, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "That email address is already registered." };
  }

  const user = await prisma.user.create({
    data: { email, displayName, passwordHash: await hashPassword(password) },
  });

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  redirect("/");
}
```

`redirect()` works by throwing, so it must be the last statement and must not sit inside a `try`. `z.flattenError(error).fieldErrors` is the Zod 4 spelling (v3's `error.flatten()` is gone).

- [ ] **Step 2: Write the login action with rate limiting** — `src/app/(auth)/login/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema, type AuthFormState } from "@/lib/auth/schemas";
import { createSession, setSessionCookie } from "@/lib/auth/session";

// C11: 6 failures per 15 minutes per email. One web process, so a Map is enough;
// Redis would be infrastructure for a problem this project does not have.
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function tooManyAttempts(email: string): boolean {
  const entry = attempts.get(email);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(email);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(email: string): void {
  const entry = attempts.get(email);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(email, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { email, password } = parsed.data;

  if (tooManyAttempts(email)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // One message for "no such user" and "wrong password" — otherwise the form
  // becomes an oracle for which email addresses are registered.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    recordFailure(email);
    return { error: "Incorrect email or password." };
  }

  attempts.delete(email);

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  redirect("/");
}
```

**Session rotation (C11):** a brand-new row with a brand-new token is created on every login, and the old cookie is overwritten — so the session id rotates on login by construction. Phase 10 adds the same call after a privilege change.

- [ ] **Step 3: Write the logout action** — `src/app/(auth)/logout/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser, invalidateSession } from "@/lib/auth/session";

export async function logout(): Promise<void> {
  const ctx = await getCurrentUser();
  if (ctx) await invalidateSession(ctx.session.id);
  await clearSessionCookie();
  redirect("/login");
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat(auth): add signup, login and logout server actions"
```

### Task 2.3: The forms

- [ ] **Step 1: Write the login page** — `src/app/(auth)/login/page.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AuthFormState } from "@/lib/auth/schemas";
import { login } from "./actions";

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      <form action={formAction} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          {state.fieldErrors?.email ? (
            <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {state.fieldErrors.email[0]}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
          {state.fieldErrors?.password ? (
            <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {state.fieldErrors.password[0]}
            </p>
          ) : null}
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        No account yet?{" "}
        <Link href="/signup" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
          Create one
        </Link>
      </p>
    </div>
  );
}
```

This is the other half of §0's one-schema rule: the page imports `login`, which imports `loginSchema` — the **same module** the test in task 2.1 exercises. `noValidate` disables the browser's own validation so the Zod messages are what the user sees.

Check the real prop signatures in `src/components/ui/Input.tsx` and `src/components/ui/Button.tsx` before wiring them up — they are Alexandre's primitives and take a variant/tone map, not arbitrary props.

- [ ] **Step 2: Write the signup page** — `src/app/(auth)/signup/page.tsx`

Same structure with three fields. `displayName` uses `autoComplete="nickname"`, `password` uses `autoComplete="new-password"`, the heading is "Create your account", the submit label is "Create account", and the footer links to `/login`.

- [ ] **Step 3: Verify the flow by hand**

```bash
npm run dev
```

Open `http://localhost:3000/signup`, create an account, confirm you land on `/`. Then:

```bash
npm run db:studio   # Session table: one row, id is 64 hex chars, not the cookie value
```

Compare the `mp_session` cookie in Chrome DevTools → Application → Cookies against `Session.id`. They must differ. Confirm the cookie is `HttpOnly`.

- [ ] **Step 4: Confirm the console is clean**

Graded requirement. Open DevTools → Console on `/login`, `/signup` and `/`. Zero warnings, zero errors — including hydration warnings and missing-key warnings.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat(auth): add the login and signup forms"
```

### Task 2.4: The route guard

- [ ] **Step 1: Move the protected routes into an `(app)` group**

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/documents "src/app/(app)/documents"
```

A route group in parentheses does not appear in the URL, so `/` and `/documents/new` are unchanged. ⚠ These are shared files — say so in the PR description and tag Amir.

- [ ] **Step 2: Write the guard** — `src/app/(app)/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";

// Every route in this group is behind a session. requireUser() redirects to
// /login when there is none. This is a convenience, not the security boundary:
// each Server Action calls requireUser() itself — see §C-4.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
```

If `next build` complains that the layout must use the generated `LayoutProps` type, use `LayoutProps<"/">` instead of the inline `{ children: ReactNode }` — route-group layouts resolve to their parent's path key.

- [ ] **Step 3: Fix the unauthenticated upload** — `src/app/(app)/documents/new/actions.ts`

Replace the demo-user block:

```ts
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { email: "demo@mespapiers.local", displayName: "Demo User" },
    });
  }
```

with:

```ts
  const { user } = await requireUser();
```

and add `import { requireUser } from "@/lib/auth/session";` at the top. The rest of the action is unchanged — it already uses `user.id` as `ownerId`. ⚠ Amir's file; this is the whole point of C5, so flag it in the PR rather than slipping it in.

- [ ] **Step 4: Scope the dashboard query to the owner** — `src/app/(app)/page.tsx`

```ts
const { user } = await requireUser();
const documents = await prisma.document.findMany({
  where: { ownerId: user.id },      // owner-scoped IN THE QUERY, not filtered in the component
  select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});
```

§7 E6's Done-when requires the scoping to live in the query. Filtering an unscoped result in the component is a review failure.

- [ ] **Step 5: Add the user and logout button to the nav** — `src/app/layout.tsx`

Read the session with `getCurrentUser()` (not `requireUser()` — the root layout also wraps `/login`, which must render for signed-out visitors). Show `Sign in` / `Sign up` links when it is `null`, and the display name plus a logout `<form action={logout}>` when it is not.

- [ ] **Step 6: Verify the guard**

```bash
npm run dev
```

In a private window, open `http://localhost:3000/` → must redirect to `/login`. Then log in, upload a document, and confirm it is attached to *your* user in `npm run db:studio`, not to a demo user.

Verify the built-in CSRF protection (§C-5) — this is C11's CSRF evidence. A made-up `Next-Action` id proves nothing, because Next rejects an unknown id for its own reasons. Use a **real** one:

1. DevTools → Network, submit the login form, open the request, and copy its `Next-Action` request header.
2. Replay it with a foreign `Origin`:

```bash
curl -i -X POST http://localhost:3000/login \
  -H "Origin: https://evil.example" \
  -H "Next-Action: <the id you copied>" \
  -H "Content-Type: multipart/form-data; boundary=x" --data ''
```

Expected: rejected, and **no new `Session` row** in `npm run db:studio`. Paste the response line into the PR — that is the evidence C11 asks for.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): guard the app routes and attach uploads to the signed-in user"
```

### Task 2.5: WS ticket endpoint (C12) — do this the day Alexandre starts D2

Not part of your four modules; it is C12, and it blocks Alexandre's WebSocket handshake (§9, R4). Two hours. Skip it until he asks, then do it immediately.

**Design:** an HMAC-signed `userId.expiry.nonce` string. No Redis, no table, no `jose`. The `realtime` process verifies the HMAC and keeps used nonces in a `Set` — single-use, and a restart only invalidates tickets younger than 60 seconds.

- [ ] **Step 1: Write the failing test** — `src/lib/auth/ticket.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { mintTicket, verifyTicket } from "@/lib/auth/ticket";

describe("ws ticket", () => {
  it("round-trips the user id", () => {
    const t = mintTicket("user-123");
    expect(verifyTicket(t)).toEqual({ userId: "user-123" });
  });

  it("rejects a tampered ticket", () => {
    const t = mintTicket("user-123");
    expect(verifyTicket(t.replace("user-123", "user-456"))).toBeNull();
  });

  it("rejects a ticket older than 60 seconds", () => {
    const t = mintTicket("user-123");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(verifyTicket(t)).toBeNull();
    vi.useRealTimers();
  });

  it("rejects a replay", () => {
    const t = mintTicket("user-123");
    expect(verifyTicket(t)).not.toBeNull();
    expect(verifyTicket(t)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyTicket("nonsense")).toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch it fail** — `npm test -- ticket`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `src/lib/auth/ticket.ts`

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 60_000;
const secret = process.env.WS_TICKET_SECRET ?? "dev-only-ticket-secret";

/** nonce -> expiry. Pruned lazily on use; no timers, so fake timers in tests
 *  and `setTimeout().unref()` typing under lib.dom both stop being a problem. */
const used = new Map<string, number>();

function sign(payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function mintTicket(userId: string): string {
  const payload = `${userId}.${Date.now() + TTL_MS}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyTicket(ticket: string): { userId: string } | null {
  const parts = ticket.split(".");
  if (parts.length !== 4) return null;
  const [userId, expiry, nonce, mac] = parts as [string, string, string, string];

  const expected = Buffer.from(sign(`${userId}.${expiry}.${nonce}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const now = Date.now();
  if (Number(expiry) <= now) return null;
  if (used.has(nonce)) return null;

  for (const [n, exp] of used) if (exp <= now) used.delete(n);
  used.set(nonce, now + TTL_MS);
  return { userId };
}
```

`timingSafeEqual` throws on unequal lengths, hence the explicit length check first. The expiry check runs before the replay check so an expired ticket never grows the Map.

- [ ] **Step 4: Run and watch it pass** — `npm test -- ticket`. Expected: 5 passed.

- [ ] **Step 5: Add the route** — `src/app/api/auth/ws-ticket/route.ts`

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { mintTicket } from "@/lib/auth/ticket";

export async function POST() {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ticket: mintTicket(ctx.user.id) });
}
```

`getCurrentUser()`, not `requireUser()` — an API route returns 401, it does not redirect to an HTML login page.

- [ ] **Step 6: Add `WS_TICKET_SECRET` to `.env.example` and `.env`**

```bash
echo 'WS_TICKET_SECRET=change-me-in-production' >> .env.example
```

§0: uncomment a key in the same PR that introduces its service.

- [ ] **Step 7: Commit and tell Alexandre**

```bash
git add src/lib/auth/ticket.ts src/lib/auth/ticket.test.ts src/app/api/auth/ws-ticket .env.example
git commit -m "feat(auth): mint single-use websocket tickets for the realtime process"
```

Tell him: `POST /api/auth/ws-ticket` → `{ ticket }`; call `verifyTicket(ticket)` from `@/lib/auth/ticket` in `src/realtime/server.ts`; it returns `{ userId }` once and `null` on every replay.

---

## Phase 3 — `can()` / `assertCan()` + audit log (C4, C6)

**Est:** 1.5d · **Entry gate:** phase 2 exit gate green.
**Exit gate for phase 4:** the truth-table test passes for every `Action` × every role; an unknown action returns `false`; a user with reputation 10 000 gains nothing. **Announce `policy.ts` at standup the day you start** — §9 lists it as a blocker for all three teammates.

**Files:**
- Create: `src/lib/auth/policy.ts`, `src/lib/auth/policy.test.ts`
- Create: `src/lib/audit.ts`

**Interfaces:**
- Consumes: `SessionContext` from `@/lib/auth/session`.
- Produces:

```ts
export type Action = /* the 24-member union from §5 */;
export type Resource = { ownerUserId?: string | null; channelId?: number | null };
export class ForbiddenError extends Error { readonly status = 403; }
export function can(ctx: SessionContext, action: Action, resource?: Resource): boolean;
export function assertCan(ctx: SessionContext, action: Action, resource?: Resource): void;
export async function writeAudit(entry: {
  actorUserId: string | null; action: string; targetType: string;
  targetId: string; channelId?: number | null; metadata?: Record<string, unknown>;
}): Promise<void>;
```

**The caller's contract, and the one subtle thing in this file:** *the caller decides which `Resource` fields to pass, and passing `ownerUserId` means "only the owner may do this."* So `answer:vote` is called as `can(ctx, "answer:vote", { channelId })` — passing the answer author's id would stop anyone from voting on anyone else's answer. Write this as a comment in `policy.ts`; it is the thing a reviewer will get wrong.

### Task 3.1: The policy module (TDD)

- [ ] **Step 1: Write the failing truth-table test** — `src/lib/auth/policy.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ForbiddenError, assertCan, can, type Action } from "@/lib/auth/policy";
import type { SessionContext } from "@/lib/auth/session";

const CHANNEL = 7;
const OTHER_CHANNEL = 8;

function ctx(over: {
  id?: string;
  globalRole?: "USER" | "ADMIN";
  reputation?: number;
  memberships?: SessionContext["memberships"];
} = {}): SessionContext {
  return {
    session: { id: "s", expiresAt: new Date(Date.now() + 1000), twoFactorVerified: false },
    user: {
      id: over.id ?? "u-self",
      email: "a@b.com",
      displayName: "A",
      avatarKey: null,
      locale: "fr",
      totpEnabled: false,
      globalRole: over.globalRole ?? "USER",
      reputation: over.reputation ?? 0,
    },
    memberships: over.memberships ?? [],
  };
}

const admin = ctx({ globalRole: "ADMIN" });
const moderator = ctx({ memberships: [{ channelId: CHANNEL, role: "MODERATOR" }] });
const member = ctx({ memberships: [{ channelId: CHANNEL, role: "MEMBER" }] });
const stranger = ctx();

describe("default-deny", () => {
  it("denies an action outside the union, even for an admin", () => {
    // `as unknown as Action` — a plain `as Action` is a compile error, because
    // TypeScript refuses a cast between literal types that do not overlap.
    expect(can(admin, "document:teleport" as unknown as Action, {})).toBe(false);
    expect(can(admin, "" as unknown as Action, {})).toBe(false);
  });
});

describe("tier 1 — global admin", () => {
  it("grants everything", () => {
    expect(can(admin, "user:manage", {})).toBe(true);
    expect(can(admin, "document:delete", { ownerUserId: "someone-else" })).toBe(true);
    expect(can(admin, "channel:moderate", { channelId: OTHER_CHANNEL })).toBe(true);
  });
});

describe("tier 2 — channel moderator", () => {
  it("moderates its own channel", () => {
    expect(can(moderator, "channel:moderate", { channelId: CHANNEL })).toBe(true);
    expect(can(moderator, "thread:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(true);
    expect(can(moderator, "answer:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(true);
    expect(can(moderator, "channel:manageRoles", { channelId: CHANNEL })).toBe(true);
  });

  it("does not moderate any other channel", () => {
    expect(can(moderator, "channel:moderate", { channelId: OTHER_CHANNEL })).toBe(false);
    expect(can(moderator, "thread:delete", { channelId: OTHER_CHANNEL, ownerUserId: "x" })).toBe(false);
  });

  it("is not a global admin", () => {
    expect(can(moderator, "user:manage", {})).toBe(false);
  });

  it("a plain MEMBER moderates nothing", () => {
    expect(can(member, "channel:moderate", { channelId: CHANNEL })).toBe(false);
    expect(can(member, "thread:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(false);
  });
});

describe("tier 3 — ownership", () => {
  it("grants the owner and denies everyone else", () => {
    expect(can(stranger, "document:read", { ownerUserId: "u-self" })).toBe(true);
    expect(can(stranger, "document:update", { ownerUserId: "u-self" })).toBe(true);
    expect(can(stranger, "document:delete", { ownerUserId: "u-self" })).toBe(true);
    expect(can(stranger, "document:read", { ownerUserId: "u-other" })).toBe(false);
    expect(can(stranger, "document:delete", { ownerUserId: "u-other" })).toBe(false);
  });
});

describe("self-service actions", () => {
  it("any signed-in user may act on their own behalf", () => {
    expect(can(stranger, "document:create", {})).toBe(true);
    expect(can(stranger, "channel:create", {})).toBe(true);
    expect(can(stranger, "channel:join", { channelId: OTHER_CHANNEL })).toBe(true);
    expect(can(stranger, "thread:create", { channelId: OTHER_CHANNEL })).toBe(true);
    expect(can(stranger, "answer:vote", { channelId: OTHER_CHANNEL })).toBe(true);
    expect(can(stranger, "gdpr:export", {})).toBe(true);
  });
});

describe("reputation is a badge, not a tier", () => {
  it("grants nothing at any level", () => {
    const helper = ctx({ reputation: 10_000 });
    expect(can(helper, "channel:moderate", { channelId: CHANNEL })).toBe(false);
    expect(can(helper, "thread:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(false);
    expect(can(helper, "user:manage", {})).toBe(false);
    expect(can(helper, "document:read", { ownerUserId: "u-other" })).toBe(false);
  });
});

describe("assertCan", () => {
  it("is silent when allowed", () => {
    expect(() => assertCan(admin, "user:manage", {})).not.toThrow();
  });

  it("throws a 403 when denied", () => {
    expect(() => assertCan(stranger, "user:manage", {})).toThrow(ForbiddenError);
    try {
      assertCan(stranger, "user:manage", {});
    } catch (e) {
      expect((e as ForbiddenError).status).toBe(403);
    }
  });
});
```

- [ ] **Step 2: Run and watch it fail** — `npm test -- policy`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `src/lib/auth/policy.ts`

```ts
import type { SessionContext } from "@/lib/auth/session";

export type Action =
  | "document:read" | "document:create" | "document:update" | "document:delete"
  | "assistant:ask"
  | "channel:create" | "channel:update" | "channel:delete" | "channel:join"
  | "channel:moderate"
  | "thread:create" | "thread:update" | "thread:delete"
  | "answer:create" | "answer:update" | "answer:delete" | "answer:vote"
  | "message:send" | "friend:request"
  | "user:manage" | "channel:manageRoles"
  | "gdpr:export" | "gdpr:delete";

/**
 * The caller chooses which fields to pass, and that choice IS the rule:
 *   - pass `ownerUserId` to mean "only the owner of this row may do it"
 *   - pass `channelId`   to mean "a moderator of this channel may also do it"
 * So answer:vote is called as { channelId } and never with the author's id —
 * passing it would stop anyone from voting on anyone else's answer.
 */
export type Resource = {
  ownerUserId?: string | null;
  channelId?: number | null;   // Channel.id is Int in the schema — §C-8
};

const ALL_ACTIONS = new Set<string>([
  "document:read", "document:create", "document:update", "document:delete",
  "assistant:ask",
  "channel:create", "channel:update", "channel:delete", "channel:join",
  "channel:moderate",
  "thread:create", "thread:update", "thread:delete",
  "answer:create", "answer:update", "answer:delete", "answer:vote",
  "message:send", "friend:request",
  "user:manage", "channel:manageRoles",
  "gdpr:export", "gdpr:delete",
]);

/** Only a global ADMIN, ever. */
const ADMIN_ONLY = new Set<Action>(["user:manage"]);

/** What a MODERATOR may do inside the channel they moderate — and nowhere else. */
const MODERATOR_ACTIONS = new Set<Action>([
  "channel:moderate", "channel:update", "channel:manageRoles",
  "thread:delete", "answer:delete",
]);

/** Any signed-in user, acting on their own behalf, with no resource to own. */
const SELF_SERVICE = new Set<Action>([
  "document:create", "assistant:ask",
  "channel:create", "channel:join",
  "thread:create", "answer:create", "answer:vote",
  "message:send", "friend:request",
  "gdpr:export", "gdpr:delete",
]);

export function can(ctx: SessionContext, action: Action, resource: Resource = {}): boolean {
  // Default-deny: an action outside the union loses before any role logic runs.
  if (!ALL_ACTIONS.has(action)) return false;

  // Tier 1 — global admin wins everywhere.
  if (ctx.user.globalRole === "ADMIN") return true;
  if (ADMIN_ONLY.has(action)) return false;

  // Tier 2 — moderator, scoped to exactly one channel.
  if (resource.channelId != null && MODERATOR_ACTIONS.has(action)) {
    const membership = ctx.memberships.find((m) => m.channelId === resource.channelId);
    if (membership?.role === "MODERATOR") return true;
  }

  // Tier 3 — ownership.
  if (resource.ownerUserId != null) {
    return ctx.user.id === resource.ownerUserId;
  }

  return SELF_SERVICE.has(action);
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(ctx: SessionContext, action: Action, resource: Resource = {}): void {
  if (!can(ctx, action, resource)) throw new ForbiddenError(action);
}
```

Note what is **not** in this file: any reference to `ctx.user.reputation`. That absence is the Helper rule from §5 — reputation is a badge and grants nothing, so reputation can never be farmed into moderation power. The test asserts it; the file enforces it by omission.

- [ ] **Step 4: Run and watch it pass** — `npm test -- policy`. Expected: 14 passed.

- [ ] **Step 5: Commit and announce**

```bash
git add src/lib/auth/policy.ts src/lib/auth/policy.test.ts
git commit -m "feat(auth): add the default-deny can/assertCan policy module"
```

Tell the team: `can()` and `assertCan()` are on `main` with the §5 signature plus `Resource.channelId: number`.

### Task 3.2: The audit log writer

- [ ] **Step 1: Implement** — `src/lib/audit.ts`

```ts
import { prisma } from "@/lib/db";

/**
 * C6: every privileged mutation writes one row. Fire-and-forget by design —
 * a failed audit write must never roll back the action the user asked for.
 * AuditLog.channelId is String? while Channel.id is Int, so it is stringified (§C-8).
 */
export async function writeAudit(entry: {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  channelId?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        channelId: entry.channelId == null ? null : String(entry.channelId),
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("audit write failed", entry.action, error);
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run lint && npm run build && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(auth): record privileged actions in the audit log"
```

---

## Phase 4 — Admin surface (C14, first half) — **Module 1 substantially complete**

**Est:** 1d · **Entry gate:** phase 3 exit gate green.
**Exit gate for phase 5:** a non-admin visiting `/admin/users` sees a rendered 403, **not a blank page and not a redirect**; an admin can list, search, promote, demote and delete users; every mutation writes an `AuditLog` row; you cannot demote or delete yourself.

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/users/actions.ts`
- Modify: `prisma/seed.ts` — give one seeded user `globalRole: "ADMIN"` and a `passwordHash`  ⚠ Amir's file

**Interfaces:**
- Consumes: `requireUser`, `can`, `assertCan`, `writeAudit`, `invalidateAllSessions`.
- Produces: no exported interface — this phase is a screen.

**This is where "different views/actions per role" (module 1's graded requirement) becomes demonstrable for global roles.** The channel-scoped half arrives in phase 7.

### Task 4.1: Seed an admin you can log in as

- [ ] **Step 1** — In `prisma/seed.ts`, give the first user `globalRole: "ADMIN"` and a real `passwordHash` produced by `hashPassword()`. Do the same for a second, plain `USER` — you need both to demo the role difference.

- [ ] **Step 2** — Reseed. `prisma/seed.ts` is **not idempotent** (no cleanup; a second run fails on the unique `email`), so reset first:

```bash
npm run db:reset && npm run db:seed
```

### Task 4.2: The 403 layout

- [ ] **Step 1: Write it** — `src/app/admin/layout.tsx`

```tsx
import type { ReactNode } from "react";
import { can } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// §C-2: rendered, not thrown. error.tsx does not wrap the layout.tsx of its own
// segment, so a throw here escapes to the root boundary and shows a blank page —
// which C14's "not a blank page" explicitly forbids.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireUser();

  if (!can(ctx, "user:manage", {})) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">403 — Forbidden</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify both roles by hand**

Log in as the plain `USER` and open `/admin/users` → the 403 card renders, the page is not blank, and the URL does not change. Log in as the `ADMIN` → the page renders.

### Task 4.3: The user list and role actions

- [ ] **Step 1: Write the actions** — `src/app/admin/users/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { invalidateAllSessions, requireUser } from "@/lib/auth/session";

export async function setGlobalRole(userId: string, role: "USER" | "ADMIN"): Promise<void> {
  const ctx = await requireUser();
  assertCan(ctx, "user:manage", {});

  // An admin who demotes themselves locks the last admin out of the admin surface.
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

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string): Promise<void> {
  const ctx = await requireUser();
  assertCan(ctx, "user:manage", {});

  if (userId === ctx.user.id) throw new Error("You cannot delete your own account here.");

  // Audit BEFORE the delete: AuditLog.actorUserId is onDelete: SetNull, and the
  // target row is about to disappear, so this is the last chance to record it.
  await writeAudit({
    actorUserId: ctx.user.id,
    action: "user:delete",
    targetType: "User",
    targetId: userId,
  });

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
```

- [ ] **Step 2: Write the page** — `src/app/admin/users/page.tsx`

A server component with `export const dynamic = "force-dynamic"`. Query with `prisma.user.findMany({ select: { id, email, displayName, globalRole, reputation, createdAt, _count: { select: { documents: true, sessions: true } } }, orderBy: { createdAt: "desc" } })` and render it in `Table` from `src/components/ui/Table.tsx`, with a `Badge` for the role. Each row carries two `<form action={…}>` buttons — promote/demote and delete — bound with `.bind(null, user.id)`. Render no buttons on your own row, since both actions throw for it. Add a `?q=` search filter on email and display name using `contains` with `mode: "insensitive"`.

- [ ] **Step 3: Verify the whole surface**

As the admin: search, promote the plain user to ADMIN, demote them back, then delete a throwaway user. Confirm in `npm run db:studio` that `AuditLog` has one row per action with the right `actorUserId`, `targetId` and `metadata`. Confirm the promoted user's `Session` rows disappeared. Confirm no buttons render on your own row. Confirm the Chrome console is clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin prisma/seed.ts
git commit -m "feat(admin): add the user list with role management and audit writes"
```

- [ ] **Step 5: Open the PR**

Title: `feat(admin): user management and role administration`. In the description, state the two §C decisions this phase depends on (rendered 403; no global MODERATOR) and tag Amir for the `prisma/seed.ts` change.

---

## Phases 5–11 — specifications

Per `CLAUDE.md`'s rule and the structure of the plan this supersedes: **phases 0–4 carry full TDD steps because you start them now; phases 5–11 are specified at task level and each is expanded into its own `docs/plans/YYYY-MM-DD-<id>.md` when its gate opens.** Expanding all of them today would produce a document written against a codebase that does not exist yet — phase 7 depends on decisions you will make in phase 5.

Each entry below is complete enough to expand from: files, interfaces, the Done-when, and the gate.

### Phase 5 — Channels and membership (E9) · 1.5d

**Expand into:** `docs/plans/<date>-e9-channels-and-membership.md`
**Entry gate:** phase 4 exit gate green, **and** the §B ownership conflict settled with Amir in writing.
**Schema:** no migration. `Channel` and `ChannelMember` exist; `ChannelMember` has `@@id([channelId, userId])`.

| Task | Deliverable | Done when |
|---|---|---|
| 5.1 | `src/lib/community/channels.ts` — `listChannels`, `getChannel`, `createChannel`, `updateChannel`, `deleteChannel`, `joinChannel`, `leaveChannel` | each mutation calls `assertCan` first; `createChannel` makes the creator a `MODERATOR` in the same transaction as the `Channel` row |
| 5.2 | `/channels` list + `/channels/new` + `/channels/[id]` | `title` ≤ 100 and `description` ≤ 250 are enforced by one Zod module in `src/lib/community/schemas.ts`, imported by both the form and the action — `@db.VarChar` will otherwise throw a raw Prisma error at the user |
| 5.3 | Join / leave | a double-clicked join creates one row because `@@id([channelId, userId])` rejects the second — caught as Prisma error `P2002` and treated as success, **not** prevented by a `findFirst` check first (§10 R5: enforce at the database) |
| 5.4 | Delete guard + audit | deleting a channel that has threads is refused with a readable message, not a foreign-key error; every mutation writes an `AuditLog` row with `channelId` |

**Watch for:** `createChannel` must write `Channel` and the creator's `ChannelMember` in one `prisma.$transaction`, or a crash between them leaves a channel nobody can moderate.

### Phase 6 — Threads, answers, votes (E10) · 1.5d

**Expand into:** `docs/plans/<date>-e10-threads-answers-votes.md`
**Entry gate:** phase 5 exit gate green.
**Schema:** no migration. `Thread`, `Answer` and `Vote` exist; `Vote` has `@@id([answerId, userId])`.

| Task | Deliverable | Done when |
|---|---|---|
| 6.1 | `src/lib/community/threads.ts` — create/list threads, create answers | `thread:create` and `answer:create` are called as `{ channelId }`; posting in a channel you have not joined is refused |
| 6.2 | `/channels/[id]/threads/[threadId]` with the answer list and composer | `title` ≤ 150 and `content` ≤ 300 enforced by the shared Zod module; R12's "channels are public" warning renders on the composer |
| 6.3 | Voting + reputation | a second vote by the same user **updates** rather than duplicating, via `prisma.vote.upsert` on the composite id; the author's `reputation` increments **in the same `$transaction` as the vote** |
| 6.4 | Author-or-moderator edit/delete | the author edits their own answer; a moderator of that channel deletes it; a member of another channel can do neither — all three via `assertCan`, all three covered by a test |

**Watch for:** `Vote.value` is a plain `Int` with no database constraint. Constrain it to `-1 | 1` in the Zod schema, or a crafted request writes `value: 9999` straight into someone's reputation.

### Phase 7 — Moderation + channel role management (E11, C14 second half) · 1.5d — **Modules 1 and 2 complete**

**Expand into:** `docs/plans/<date>-e11-moderation-and-channel-roles.md`
**Entry gate:** phase 6 exit gate green.
**Schema:** ⚠ **first migration of this plan.** Add `Thread.hiddenAt DateTime?` + `Thread.hiddenById String?`, `Answer.hiddenAt DateTime?` + `Answer.hiddenById String?`, `ChannelMember.mutedUntil DateTime?`. `prisma/` is Amir's directory — get his review before `npm run db:migrate`.

| Task | Deliverable | Done when |
|---|---|---|
| 7.1 | Migration `add_moderation_fields` | `npm run db:migrate` applies cleanly and `npm run db:generate` regenerates; a fresh `db:reset` replays it |
| 7.2 | `src/lib/community/moderation.ts` — `hideThread`, `hideAnswer`, `unhide`, `muteMember`, `unmuteMember` | each writes an `AuditLog` row carrying `channelId` and the target |
| 7.3 | Hidden content rendering | hidden content disappears for members and renders for moderators **with a visible marker**; the moderator's view comes from a different query branch, not a CSS `hidden` class over data already sent to the browser |
| 7.4 | Mute enforcement | a muted member's `thread:create` and `answer:create` are refused server-side until `mutedUntil` passes; the composer is disabled in the UI **and** the action refuses — the UI alone is not a boundary |
| 7.5 | **C14: promote/demote channel moderators** | an ADMIN promotes a member to MODERATOR in one channel and that user gains hide/mute **only there**, verified in a second channel; a moderator can also promote within their own channel (`channel:manageRoles` is in `MODERATOR_ACTIONS`) |
| 7.6 | Reputation → Helper badge | crossing the threshold renders the badge and grants **no** action — assert it with a `can()` test at high reputation, which phase 3 already wrote |

**This closes both module 1 and module 2.** Demo script for the evaluation: one channel, three browsers — admin, moderator, member — showing three different views of the same thread.

### Phase 8 — OAuth 2.0 Google (C7) · 1.5d

**Expand into:** `docs/plans/<date>-c7-oauth-google.md`
**Entry gate:** phase 7 exit gate green. *(Technically only phase 2 is required — but phases 5–7 are the critical path for Alexandre and worth more module points. Start OAuth early only if phases 5–7 are blocked.)*
**Schema:** no migration. `OAuthAccount` exists with `@@unique([provider, providerUserId])`.
**Env:** uncomment `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.example` in this PR.

| Task | Deliverable | Done when |
|---|---|---|
| 8.1 | `src/lib/auth/oauth/pkce.ts` — `createVerifier()`, `challengeFor(verifier)`, `createState()` | S256 challenge is `base64url(sha256(verifier))`, verified against a hand-computed fixture; all three use `node:crypto`, no dependency |
| 8.2 | `GET /api/auth/google/start` | sets `state` and `code_verifier` in **httpOnly, 10-minute, `sameSite: lax`** cookies and redirects to Google's authorization endpoint with `code_challenge_method=S256` |
| 8.3 | `GET /api/auth/google/callback` | a mismatched `state` is rejected; a **replayed** callback is rejected because the callback deletes both cookies before doing anything else; the token exchange sends the `code_verifier` |
| 8.4 | Account resolution | existing `OAuthAccount` → sign in; no account but the email matches a `User` → **link** to that user; neither → create the user with `passwordHash: null` |
| 8.5 | Login page button | "Continue with Google" appears on `/login` and `/signup` |

**Watch for:** `sameSite: "lax"` on the state cookie, not `strict` — Google's redirect is a cross-site navigation and `strict` drops the cookie, giving a state mismatch on every attempt.

### Phase 9 — OAuth 2.0 GitHub + linking edge cases (C8) · 1d — **Module 3 complete**

**Expand into:** `docs/plans/<date>-c8-oauth-github.md`
**Entry gate:** phase 8 exit gate green.
**Env:** uncomment `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in this PR.

| Task | Deliverable | Done when |
|---|---|---|
| 9.1 | Generalise phase 8 into `src/lib/auth/oauth/providers.ts` | Google and GitHub are **two config objects** (`authorizeUrl`, `tokenUrl`, `scope`, `fetchProfile`) consumed by shared `start`/`callback` helpers — two objects and two functions, not a provider registry or a factory |
| 9.2 | GitHub routes | sign-in completes end to end |
| 9.3 | GitHub email resolution | GitHub's `/user` often returns `email: null`; the profile fetcher calls `/user/emails` and takes the **primary and verified** address, refusing sign-in when there is none |
| 9.4 | Linking in **both** orders | password account → then GitHub sign-in → one `User` with one `OAuthAccount`; GitHub sign-up → then Google sign-in on the same email → one `User` with two `OAuthAccount` rows. C8's Done-when names both orders explicitly |

**Watch for:** an unverified email from an OAuth provider is an account-takeover vector — anyone can register `your@email.com` on GitHub without proving it. Refuse unverified addresses rather than linking on them.

### Phase 10 — TOTP 2FA (C9) · 1.5d

**Expand into:** `docs/plans/<date>-c9-totp-2fa.md`
**Entry gate:** phase 9 exit gate green.
**Schema:** ⚠ **second and last migration.** Add `User.recoveryCodes String[]` (SHA-256 digests, not the codes) and `Session.twoFactorVerifiedAt DateTime?`. `User.totpSecret` and `User.totpEnabled` and `Session.twoFactorVerified` already exist. Amir reviews.
**Deps:** `npm install otpauth@^9.5.2 qrcode@^1.5.4` + `npm install -D @types/qrcode`.

| Task | Deliverable | Done when |
|---|---|---|
| 10.1 | Migration `add_2fa_fields` | applies cleanly; a fresh `db:reset` replays it |
| 10.2 | `src/lib/auth/totp.ts` — `createSecret`, `otpauthUri`, `verifyCode`, `generateRecoveryCodes`, `consumeRecoveryCode` | `verifyCode` accepts a code from the **previous, current and next** 30-second window (`window: 1`) and rejects one two windows out — tested with `vi.setSystemTime`, no live clock |
| 10.3 | Enrollment at `/settings/security` | the QR **scans in a real authenticator app**; `totpEnabled` only flips to `true` after the user submits a valid code, so nobody can lock themselves out by navigating away mid-enrollment |
| 10.4 | Recovery codes | exactly 10 are shown **once**, stored only as digests, and each works **exactly once** — the consuming update removes it from the array in the same query |
| 10.5 | Login second step | when `totpEnabled`, login creates the session but leaves `twoFactorVerified: false` and redirects to `/login/2fa`; the `(app)` guard refuses a session that is `totpEnabled && !twoFactorVerified` |
| 10.6 | Disable 2FA | requires a current code, clears `totpSecret`, `totpEnabled` and `recoveryCodes`, and writes an `AuditLog` row |

**Watch for:** the same rate limit as login must cover the 2FA step, or the second factor becomes a 6-digit brute force. Reuse the `attempts` Map from `src/app/(auth)/login/actions.ts` — export it rather than writing a second one.

### Phase 11 — Step-up 2FA on destructive actions (C10) · 0.5d — **Module 4 complete**

**Expand into:** `docs/plans/<date>-c10-step-up-2fa.md`
**Entry gate:** phase 10 exit gate green **and** phase 7 green (channel delete is one of the actions it protects).
**Schema:** none — phase 10's `twoFactorVerifiedAt` covers it.

| Task | Deliverable | Done when |
|---|---|---|
| 11.1 | `requireFreshTwoFactor(ctx)` in `src/lib/auth/totp.ts` | returns immediately when `!ctx.user.totpEnabled`; redirects to `/verify-2fa?next=…` when `twoFactorVerifiedAt` is null or older than **15 minutes** |
| 11.2 | Apply it | `deleteChannel` (phase 5), `deleteUser` (phase 4), and the self-service account delete each demand a fresh code |
| 11.3 | Offer it to teammates | tell Amir the helper exists for `document:delete` (E13) and the GDPR export (E12) — C10's Done-when names both, and they are his files |
| 11.4 | Re-verification page | submitting a valid code sets `twoFactorVerifiedAt = now()` and returns to `next`; `next` is validated to be a **relative path**, or it is an open-redirect |

---

## Coverage check

Every "To Do" from the four modules, mapped to the phase that delivers it.

| Module | To Do | Phase |
|---|---|---|
| 1 · Advanced permissions | `can()` / `assertCan()` policy module | 3 |
| | Admin surface — user list, promote/demote | 4 |
| | Role-based route guards | 2 (`(app)`), 4 (`/admin` 403) |
| | Audit log writes | 3 (`writeAudit`), 4 · 5 · 7 (call sites) |
| | User CRUD | 2 (create), 4 (read/update/delete) |
| | Roles admin / user / moderator | 4 (global), 7 (channel-scoped) — §C-1 |
| | Different views/actions per role | 4 (admin vs user), 7 (moderator vs member) |
| 2 · Organizations | Channel CRUD | 5 |
| | Join / leave | 5 |
| | Membership roles | 5 (assignment), 7 (promote/demote) |
| | Threads + answers + votes UI | 6 |
| | Moderation — hide / mute | 7 |
| 3 · OAuth 2.0 | Authorization-code + PKCE for Google | 8 |
| | Same for GitHub | 9 |
| | Callback routes | 8, 9 |
| | Account linking when the email exists | 8.4, 9.4 |
| 4 · 2FA | TOTP enrollment with QR | 10.3 |
| | Verification with drift | 10.2 |
| | 10 single-use recovery codes | 10.4 |
| | Step-up on destructive actions | 11 |
| *(foundation)* | Email + password auth, hashed and salted | 0.4, 1, 2 |
| *(foundation)* | Sessions, protected routes | 1, 2 |
| *(teammate unblock)* | WS ticket endpoint (C12) | 2.5 |

**Deliberately out of scope of this plan:** C13 (the OWASP / `npm audit` / `gitleaks` security review) is a week-5 task with no code dependency, and the `[locale]` migration (§C-3) lands in whichever PR follows Alexandre's D10.

**Total: ≈ 15.5 days** against §7's 15-day Domain C budget — before the 4 days of E9–E11 that §7 assigns to Amir. See §B's capacity warning.
