# Rasiol's Four Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Rasiol's four graded modules from `PROJECT_PLAN.md` §6 — standard user management & authentication (major), advanced permissions (major), OAuth 2.0 (minor), TOTP 2FA (minor) — in the order the current codebase actually permits, unblocking three teammates as early as possible. The organization system (channels, E9–E11) is **Amir's** module; this plan only puts the policy into it (phases 5–7, revised 2026-10-02).

**Architecture:** Database-backed opaque sessions (random token in an httpOnly cookie, only its SHA-256 stored), one synchronous default-deny `can()` policy function resolving three tiers (global admin → channel moderator → resource owner), and Server Actions that each call `requireUser()` then `assertCan()`. No auth in middleware, no auth library, no service layer — plain functions in `src/lib/auth/`.

> **Status (revised 2026-10-05, evening):** phases **0, 1, 2.1–2.4 and 3 are done and merged** (PRs #10, #13 and #18, `main` = `2f9acc9`). **Task 2.5 is built and in review**: `60bbe07` on `feat/auth-ws-ticket`, PR #22 open; its boxes get ticked when it merges. **Next: phase 4**, then phase 5 (unblocked since `feat/channels` merged in PR #9). Code in the done phases is the plan as written; each one opens with an *As shipped* note listing where the merged code differs. Phases 4–11 were rewritten on 2026-10-02 against `[locale]` routes, i18n keys and Amir's `feat/channels`, and checked against `main` on 2026-10-05. `handoff/WORKLOG.md` remains the day-to-day progress log.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Prisma 6 (generator `prisma-client` → `src/generated/prisma/`) · PostgreSQL 17 · Vitest 5 · Zod 4 · `@node-rs/argon2` · `otpauth` · `node:crypto`

**Spec:** [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) §0 (constraints), §4 (file ownership), §5 (published interfaces), §7 Domain C + E9–E11 (WBS), §9 (dependencies) · [`subject_requirements.md`](../../subject_requirements.md)

**Supersedes:** `docs/plans/2026-09-17-c1-auth-contract-and-session-core.md`. That file was lost while `docs/` was untracked; its two recorded decisions are carried forward verbatim in §C below. `docs/` has been committed since `f07b382` (PR #13), and `CLAUDE.md` points at this file.

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
- New UI primitives go in `src/components/ui/` **and** into the gallery at [`/[locale]/dev/ui`](../../src/app/[locale]/dev/ui/page.tsx).
- **Every page lives under `src/app/[locale]/`** (API routes stay at `src/app/api/`, not localised). Every user-visible string is a `next-intl` key: add it to `messages/fr.json` first (it types `t()`), then `en.json` and `es.json`. Server Action error messages are keys too (see `AuthErrorKey` in `src/lib/auth/schemas.ts`).
- Import `Link`, `redirect`, `usePathname`, `useRouter` from `@/i18n/navigation`. In a Server Action: `return redirect({ href, locale: await getLocale() })`. The `return` is needed because TypeScript does not treat the destructured `redirect` as `never`.
- `revalidatePath` takes the route **file** pattern plus a type: `revalidatePath("/[locale]/(app)/admin/users", "page")`. A bare `/admin/users` matches nothing under `[locale]`.

---

## A. Dependency analysis — why this order

### What exists today (2026-10-05, `main` = `2f9acc9`)

- **Auth core, merged:** `src/lib/auth/password.ts` (argon2id), `session.ts` (§5's interface plus `memberships`, 30-day sessions that never slide, cookie `mp_session` always `Secure`), `schemas.ts` (shared Zod, error messages are `auth.errors.*` keys). Tests: `password`, `session`, `schemas` and `login/actions.test.ts` (rate limit).
- **Policy and audit, merged (PR #18):** `policy.ts` (`can`, `assertCan`, `ForbiddenError`, 23 actions) and `audit.ts` (`writeAudit`). **No call sites yet.**
- **Routes:** `src/app/[locale]/(auth)/{login,signup,logout}`, and the `(app)` group whose `layout.tsx` calls `requireUser()`. The dashboard, the category page, `uploadDocument`, `deleteDocument` (`src/app/[locale]/action.ts`) and `GET /api/documents/[id]` each call `requireUser()`/`getCurrentUser()` and scope by `ownerId`. A foreign document id gives 404. `src/components/Nav.tsx` shows the user and logout.
- **i18n:** `next-intl`, `fr`/`en`/`es`, `localePrefix: "always"`, `src/middleware.ts` (locale routing only). `Locale` is exported from `src/i18n/config.ts`.
- **In review:** `ticket.ts` + `POST /api/auth/ws-ticket` (task 2.5, PR #22). Nothing calls `verifyTicket()` yet: that is Alexandre's handshake.
- **Missing:** OAuth, TOTP, the admin surface. `AUTH_STUB` was never built, and phase 3 removed it from `.env.example`. No `error.tsx` anywhere.
- **Merged from teammates (all on 2026-10-05):**
  - Amir's `feat/channels` (PR #9) covers most of E9: channel create/edit/delete, public join, private channels with invites and join requests, kick, leave, plus answer create/edit/delete. It added three migrations (`ChannelInvite`, `ChannelJoinRequest`, `Channel.isPrivate`) and **rewrote `prisma/seed.ts`**. Every check in it is inline (`role === "MODERATOR"`, `createdBy !== user.id`), and a refusal is a silent `return`. E10 (votes) and E11 (hide/mute) are not started.
  - Alexandre's `src/contracts/events.ts` (PR #15) and a bare `ws` server in `src/realtime/` (PR #16): **no authentication on connect**, no topics, and `src/lib/realtime/publish.ts` is a stub. His `friends` branch is in flight.
  - Adrien's `src/lib/ai/extract.ts` (PR #20), called by `classifyDocument()` on upload, and the `add_document_deadline` migration.

### The blocking dependencies, in order

| # | Piece | Blocks | Status |
|---|---|---|---|
| 1 | Vitest + `zod` + `@node-rs/argon2` | every task | ✅ phase 0 |
| 2 | `session.ts`: `requireUser()` and friends | everything, and 3 teammates | ✅ phase 1, used by Amir's branch |
| 3 | Login / signup + the `(app)` guard | phases 3–11 | ✅ phase 2 |
| 4 | **`policy.ts`: `can()` / `assertCan()`** | modules 1–2, and 3 teammates | ✅ phase 3 (PR #18). No call sites yet: Amir's merged actions still check inline, which phase 5 converts. |
| 5 | **`writeAudit()`** | admin surface, moderation | ✅ phase 3 (PR #18) |
| 6 | Amir's `feat/channels` merged | phase 5 (policy in his actions), phase 6 (channel roles) | ✅ PR #9 (2026-10-05) |
| 7 | Amir's E10 (votes, reputation) and E11 (hide/mute) | phase 6's Helper badge, phase 7 | not started |

### Module order

```
Phase 0–2  tooling · session core · login/guard ✅      merged (PRs #10, #13)
   │
Phase 3    can() + audit (C4, C6) ✅                    merged (PR #18)
   │
Phase 4    admin surface (C14a)               NEXT      → MODULE 1 done
   │
   ├──────────────────────────────────────┬──────────────────────────────────────
   │ Track A — waits on Amir's merges     │ Track B — no outside dependency
   │ Phase 5   policy in channel actions  │ Phase 8   OAuth Google (C7)
   │ Phase 6   channel roles + Helper     │ Phase 9   OAuth GitHub (C8)  → MODULE 3
   │ Phase 7   moderation sign-off (E11)  │ Phase 10  TOTP (C9)
   │           → MODULE 2 done            │ Phase 11  step-up (C10)      → MODULE 4
```

**The load-bearing observation (revised 2026-10-05):** phase 4 is the critical path. Phase 5 is unblocked now that `feat/channels` is merged; phase 6's Helper part and phase 7 wait on Amir's E10/E11; phases 8–11 depend only on phase 2. So after phase 4, do phase 5, and OAuth/TOTP in the gaps. Do not leave phase 5 waiting behind OAuth: permissions is 2 of your 6 points, and its graded demo, "different actions per role", needs the channel tier.

**Module 1 (user management & auth)** is complete at phase 4 for what this plan owns: signup, login, sessions, the admin user list. The profile and settings page (D14: display name, locale, avatar, Helper badge) is built by Alexandre and counts toward this module (§6). **Module 2 (advanced permissions)** is complete at phase 7, once the channel-moderator tier is in use in real channels.

---

## B. Teammate dependencies

### What you owe them (and when it stops hurting)

| Deliverable | Phase | Who is blocked | Note |
|---|---|---|---|
| `requireUser()` / `getCurrentUser()` | 1 | Amir, Adrien, Alexandre | ✅ merged, and already in use on `feat/channels` |
| `can()` / `assertCan()` | 3 | Amir (his channel actions), Alexandre (WS topic authz), Adrien (assistant context) | ✅ PR #18. Still owed: the standup announcement (§C-17 and §C-18 change what a published interface means) and the phase 5 mapping table for Amir. |
| WS ticket + `verifyTicket()` | 2 (task 2.5) | Alexandre (D2 handshake) | Built, PR #22 open. Still owed: tell him the contract (task 2.5 step 7), that `realtime` needs the same `WS_TICKET_SECRET` (`npm run realtime` does not load `.env`), and that nginx has no `/ws` block yet. |
| Channel-role management (C14b) | 6 | Amir's moderators can only be the channel creator until it exists | unblocked (PR #9 merged) |

### What you need from them

| Need | Owner | Blocks | Status |
|---|---|---|---|
| `components/ui` primitives | Alexandre (D0) | — | ✅ in `src/components/ui/` |
| `app/[locale]/` + `next-intl` (D10, D11) | Alexandre | — | ✅ PR #12. All new routes go under `[locale]`; §C-3 is obsolete. |
| `DocumentCategory` | Amir | — | ✅ PR #11. `Document.version` is still missing, and nothing of yours needs it. |
| `feat/channels` merged | Amir | phases 5 and 6 | ✅ PR #9 (2026-10-05). The review notes still open are in phase 5. |
| E10 votes/reputation, E11 hide/mute | Amir | phase 6's Helper part, phase 7 | not started |
| Redis | Adrien | nothing of yours | The login limiter and the WS nonce set are in-process Maps. |

### Ownership: E9–E11 are Amir's (resolved in practice; write it down)

`PROJECT_PLAN.md` §6 gives the organization module to Amir, and §7 gives him E9, E10 and E11. He built E9 on `feat/channels` (PR #9, merged 2026-10-05). The original roadmap claimed them for phases 5–7. That claim is dropped, and phases 5–7 below now cover only your share: the policy (C4/C5/C6) applied to his actions, and channel-role management (C14b). **Action:** add one dated line to `MEETING_DISCUSSION.md` so the decision is visible to the team, not only to this file.

---

## C. Recorded departures from `PROJECT_PLAN.md`

Each one is a deliberate, reversible choice. Read them out at evaluation rather than letting them look like gaps.

1. **`GlobalRole` stays `USER | ADMIN`. `MODERATOR` is not added.** *(carried forward from the lost 2026-09-21 doc)* Moderator is a `ChannelRole`, scoped to exactly one channel. A global `MODERATOR` would contradict §5's "a `MODERATOR` membership on `resource.channelId` grants … **inside that channel only**". **No schema change.**

2. **The admin route renders its 403 from `layout.tsx` instead of throwing.** *(carried forward)* `error.tsx` does not wrap the `layout.tsx` in its own segment, so a `throw` in the layout escapes to the root error boundary and the user sees a blank page — which C14's Done-when explicitly forbids ("a non-admin hitting the admin route gets 403, **not a blank page**"). Next 16's `forbidden()` would be the idiomatic answer, but it requires `experimental.authInterrupts` (confirmed in `node_modules/next/dist/docs/.../forbidden.md`), and the project does not enable experimental flags.

3. ~~**Routes are flat now, migrated under `app/[locale]/` later.**~~ **Obsolete since PR #12 (2026-09-27).** `next-intl` shipped before phase 2's pages, so they were built under `src/app/[locale]/` with message keys from the start. Every later phase does the same.

4. **No auth in `middleware.ts` / `proxy.ts`.** *(Updated: `src/middleware.ts` now exists for next-intl locale routing only, and holds no auth.)* §7 C3 says "route middleware". Next 16 renamed middleware to `proxy.ts`, and its own authentication guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) does not use it for auth at all — it documents proxy checks as *optimistic only*, explicitly warning against database reads there because it runs on every prefetch. The real boundary is `requireUser()` in the segment layout plus `requireUser()` + `assertCan()` inside every Server Action, which is both simpler and stricter. Render-time gating is not a security boundary; the action check is.

5. **CSRF is Next.js's built-in Server Action Origin/Host check — no token implementation.** §7 C11 asks for CSRF. `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:82` documents it: "The request's `Origin` is compared to the `Host` (or `X-Forwarded-Host`). Mismatches are rejected." `infra/nginx/nginx.conf:66` sets `proxy_set_header Host $host`, so `Origin: https://mespapiers.local` matches `Host: mespapiers.local` and **no `serverActions.allowedOrigins` entry is needed**. Hand-rolling a second CSRF layer on top would be exactly the overengineering this plan avoids. Verify it once in phase 2 with a curl that sends a wrong Origin.

6. **`SessionContext` gains a `memberships` field.** §5 publishes `can()` as **synchronous**, and the channel-MODERATOR tier must know the caller's role in `resource.channelId`. A sync function cannot query. So `validateSessionToken()` loads memberships alongside the user (one `include`, one query) and `can()` reads them from the context. This is **additive** to the published interface — no existing field changes — but announce it at standup per §5.

7. **`SessionUser.locale` is typed `string`, not `Locale`.** *(Updated: D10 has landed and `Locale` plus `isLocale()` exist in `src/i18n/config.ts`, but `User.locale` is still `String @default("fr")`, so narrowing it needs a runtime check, not a type change.)* Narrow it with `isLocale(user.locale) ? user.locale : defaultLocale` in `validateSessionToken()` when someone first needs a typed `Locale` (D10's "persists to `User.locale`"). Until then it stays `string`.

8. **`Resource.channelId` is `number`, not `string`.** §5 types it `string | null`; `Channel.id` is `Int @id @default(autoincrement())`. The schema wins. Note the matching wart: `AuditLog.channelId` **is** `String?`, so `writeAudit()` stringifies. Do not "fix" either — a migration to align them buys nothing.

9. **Tests run against the dev database, not a separate test database.** Every DB test creates users with a `randomUUID()` email and deletes them in `afterEach`; `onDelete: Cascade` cleans up sessions and audit rows. A second database plus its migration lifecycle is infrastructure this project does not need.

10. **Password hashing is `@node-rs/argon2`** — matching §2's table verbatim (Argon2id, prebuilt binaries, no node-gyp). Confirmed available at `2.2.1`.

*Added 2026-10-02, from what phases 1–2 shipped and what phases 3–7 need:*

11. **Sessions do not slide.** C1's Done-when mentions "sliding renewal". Sessions last 30 days from login and are never extended (`b1dc30f`). The reason is that Next cannot set a cookie while rendering, only in Server Actions and Route Handlers, so a renewed row would outlive its cookie. The test is `never extends the expiry set at login`.

12. **The session cookie is `Secure` always**, not only in production. Compose runs `next dev` behind nginx TLS, so a `NODE_ENV` check would never set the flag. Browsers accept `Secure` cookies on `http://localhost`.

13. **`AUTH_STUB` was never built.** §9 wanted it so teammates could work before the session core existed, and C3 lists it. The real session core shipped first, so the stub never had a job. Phase 3 deletes the commented `AUTH_STUB` line from `.env.example`, as §8 W2 says to do.

14. **A foreign document is a 404, not a 403.** C5 says "returns 403". E6 says "another user's id 404s". The shipped code follows E6: the queries are owner-scoped, so a foreign id cannot be told apart from a missing one, and a 403 would confirm that the id exists. Admins do not read other users' papers through these routes: the owner-scoped `where` decides, and since §C-17 `can()` refuses it as well.

15. **Posting needs a membership.** §5's three tiers make `thread:create`, `answer:create` and `answer:vote` available to anyone. Private channels now exist (Amir's `isPrivate`), and his actions already refuse non-members, so `can()` checks `ctx.memberships` for those three actions (phase 3). This is additive: the signature does not change.

16. **Member management maps onto `channel:moderate`.** Amir's invite, accept/reject join request and kick actions are moderator-only inside one channel, which is what `channel:moderate` already means. Adding new `Action` members would change a published interface and need a whole-team decision, and nothing would gain from it. The `writeAudit()` action string records which operation it was (`channel:kick`, …).

*Added 2026-10-03, from the phase 3 final review:*

17. **The document vault is owner-only, even for an admin.** §5 says tier 1 (ADMIN) "wins everywhere". The vision (§3) says "no role — moderator or admin — can read another user's vault", checked on all four paths, including the assistant endpoint. The vision wins: `can()` answers `document:read`, `document:update` and `document:delete` with ownership alone, before tier 1 runs, and a call without `ownerUserId` is refused. This also makes `assertCan(ctx, "document:read", doc)` safe for Adrien's assistant context (B10), where tier 1 would have handed an admin anyone's ID papers. The signature is unchanged, but the meaning of a published interface changed: **announce it to the team.**

18. **Only an admin manages channel roles.** This roadmap's task 6.1 let a moderator promote and demote inside their own channel. The vision (§3: a moderator is "assigned per channel by an Admin", and the Admin can "promote and demote moderators"), §5 (`channel:manageRoles` is tagged "admin surface") and C14's Done-when ("an ADMIN promotes…") all reserve it for admins. The spec wins: `channel:manageRoles` is in `ADMIN_ONLY`, so a moderator cannot appoint more moderators (sockpuppet moderation is the same farming the Helper rule prevents). Task 6.1 is updated. The meaning of a published interface changed: **announce it to the team.**

*Added 2026-10-06, before phase 4:*

19. **Deleting a channel's only moderator leaves the channel without one, and that is accepted.** Phase 4's `deleteUser` cascades the user's `ChannelMember` rows and sets `Channel.createdBy` to null; pages already render a missing author as `t("deletedUser")`. Until phase 5 the channel is frozen, because Amir's inline checks need a `MODERATOR` membership and an admin has none. From phase 5, tier 1 lets an admin moderate, edit and delete every channel; from phase 6, an admin appoints a successor with `setChannelRole`. Refusing the delete was rejected: the only fix would be promoting someone first, which does not exist until phase 6, so every seeded channel creator (each its channel's only moderator) would be undeletable, and a reachable refusal would need its own i18n error. Auto-promoting a remaining member was rejected too: it hands moderation to someone nobody chose, which §C-18 forbids.

---

## D. File structure

Everything below is yours per §4 unless marked. **Files that change together live together**; each file has one responsibility.

✅ = on `main`. Paths are as shipped.

```text
vitest.config.mts                         P0 ✅ runner, @ alias, inlines next-intl (must stay .mts)
vitest.setup.ts                           P0 ✅ loads .env for DATABASE_URL

src/lib/auth/
├─ password.ts                            P0 ✅ hashPassword / verifyPassword
├─ session.ts                             P1 ✅ §5's published interface + memberships
├─ schemas.ts                             P2 ✅ THE Zod module for signup + login; AuthErrorKey
├─ rate-limit.ts                          P10  login limiter moved out of login/actions.ts so 2FA shares it
├─ ticket.ts                              P2.5 WS ticket mint/verify (C12, Alexandre), PR #22
├─ policy.ts                              P3 ✅ Action union, can(), assertCan()
├─ totp.ts                                P10  secret, URI, verify, recovery codes, requireFreshTwoFactor
└─ oauth/
   ├─ pkce.ts                             P8   verifier + challenge + state
   └─ providers.ts                        P8/9 Google and GitHub as two config objects

src/lib/audit.ts                          P3 ✅ writeAudit()

src/app/[locale]/
├─ (auth)/login/{page,actions,actions.test}  P2 ✅
├─ (auth)/signup/{page,actions}           P2 ✅
├─ (auth)/logout/actions.ts               P2 ✅
├─ (auth)/login/2fa/page.tsx              P10  second login step
├─ (app)/layout.tsx                       P2 ✅ requireUser() — convenience guard, not the boundary
├─ (app)/page.tsx, documents/, action.ts  P2 ✅ owner-scoped                 ⚠ Amir's
├─ (app)/admin/layout.tsx                 P4   403 render, not throw (§C-2)
├─ (app)/admin/users/{page,actions}       P4
├─ (app)/channels/                        ⚠ Amir's (PR #9). P5 swaps his checks for assertCan, P6 adds the role buttons
├─ (app)/settings/security/               P10  TOTP enrollment (route name to settle with Alexandre's D14 settings page)
└─ (app)/verify-2fa/page.tsx              P11  step-up re-verification

src/app/api/auth/                         not localised (the middleware matcher skips /api)
├─ ws-ticket/route.ts                     P2.5 PR #22
├─ google/{start,callback}/route.ts       P8
└─ github/{start,callback}/route.ts       P9

src/components/Nav.tsx                    ⚠ Alexandre's. P4 adds an admin-only link
messages/{fr,en,es}.json                  every phase with UI: fr.json first (it types t())
```

**One schema migration** remains in this plan: **phase 10** (2FA columns). Phase 7's moderation columns are now Amir's to add as part of E11. `prisma/` is Amir's directory. Coordinate the phase 10 migration with him: `main` already has seven, three of them his.

---

## Phase 0 — Tooling gate ✅

> **Done.** `84107cd` "chore(auth): add vitest and hash passwords with argon2id", merged with PR #10. **As shipped:** the config is `vitest.config.mts`, because a `.ts` config loads as CommonJS and warns. It gained `server.deps.inline: ["next-intl"]` in phase 2, because next-intl's extensionless `next/navigation` import breaks Node ESM. `docs/` was committed in `f07b382` (PR #13), not in task 0.1. `zod` resolved to `^4.6.5`.

**Est:** 0.5d · **Entry gate:** none · **Exit gate for phase 1:** `npm test` runs and passes; `npm run lint` and `npm run build` are clean.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/lib/auth/password.test.ts`
- Create: `src/lib/auth/password.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, storedHash: string): Promise<boolean>` from `@/lib/auth/password`.

### Task 0.1: Regenerate the Prisma client and commit `docs/`

The checked-out `src/generated/prisma/` is **stale**: `enums.ts` says *"This file is empty because there are no enums in the schema"* and `models/` holds only `Document.ts` and `User.ts`, while the schema has 16 models and 4 enums. Every import of `GlobalRole` or `ChannelRole` fails until this is fixed.

- [x] **Step 1: Regenerate**

```bash
sudo chown -R $USER:$USER src/generated   # only if a container has run since your last generate
npm run db:generate
grep -c "GlobalRole\|ChannelRole" src/generated/prisma/enums.ts
```

Expected: a non-zero count. If it prints `0`, the generate did not pick up the schema — check `DATABASE_URL` in `.env` and re-run.

- [x] **Step 2: Put `docs/` under version control**

`CLAUDE.md` records that `docs/`, `MEETING_DISCUSSION.md` and `CLAUDE.md` are untracked, which is how the previous version of this plan was lost. Fix it now, before it happens twice.

```bash
git add docs/ MEETING_DISCUSSION.md CLAUDE.md
git commit -m "docs: track project plans, meeting notes and agent guidance"
```

### Task 0.2: Install the dependencies

- [x] **Step 1: Install**

```bash
npm install zod@^4.5.4 @node-rs/argon2@^2.2.1
npm install -D vitest@^5.0.1
```

`zod` currently resolves only as a transitive dependency of `eslint-plugin-react-hooks`. It must be a direct dependency before anything imports it. Note it is the **v4 API** — `z.email()`, not `z.string().email()`.

- [x] **Step 2: Add the test scripts to `package.json`**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### Task 0.3: Configure Vitest

- [x] **Step 1: Create `vitest.config.ts`**

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

- [x] **Step 2: Create `vitest.setup.ts`**

```ts
// Prisma needs DATABASE_URL. next dev loads .env itself; Vitest does not.
import "dotenv/config";
```

### Task 0.4: Password hashing (TDD)

- [x] **Step 1: Write the failing test** — `src/lib/auth/password.test.ts`

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

- [x] **Step 2: Run it and watch it fail**

```bash
npm test -- password
```

Expected: FAIL — `Failed to resolve import "@/lib/auth/password"`.

- [x] **Step 3: Write the implementation** — `src/lib/auth/password.ts`

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

- [x] **Step 4: Run the tests and watch them pass**

```bash
npm test
```

Expected: 4 passed.

- [x] **Step 5: Verify the whole toolchain is still clean**

```bash
npm run lint && npm run build && npm run typecheck
```

Expected: no warnings, no errors. (`npm run build` must precede `typecheck` — `next build` generates the route types the root layout uses.)

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/lib/auth/password.ts src/lib/auth/password.test.ts
git commit -m "chore(auth): add vitest, zod and argon2; hash passwords with argon2id"
```

---

## Phase 1 — Session core (C1) ✅

> **Done.** PR #10, `0dcdb38` (2026-09-25). **As shipped:**
> - **No sliding renewal** (`b1dc30f`, §C-11). The `slides the expiry…` test in task 1.2 became `never extends the expiry set at login`, and `RENEW_WHEN_LESS_THAN_MS` was removed. Sessions last 30 days from login.
> - `setSessionCookie` sets `secure: true` always (§C-12), not `NODE_ENV === "production"` as in task 1.3.
> - `requireUser()` calls `next/navigation`'s `redirect("/login")` with no locale. The next-intl middleware adds the prefix from its locale cookie (verified: `/es/documents/new` → `/es/login`).

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

- [x] **Step 1: Write the failing test** — `src/lib/auth/session.test.ts`

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

- [x] **Step 2: Run it and watch it fail**

```bash
npm test -- session
```

Expected: FAIL — `Failed to resolve import "@/lib/auth/session"`.

- [x] **Step 3: Write the two functions** — `src/lib/auth/session.ts`

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

- [x] **Step 4: Run and watch them pass**

```bash
npm test -- session
```

Expected: 3 passed.

- [x] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): generate opaque session tokens and store only their sha-256"
```

### Task 1.2: Create, validate, invalidate (TDD)

- [x] **Step 1: Add the failing tests** — append to `src/lib/auth/session.test.ts`

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

- [x] **Step 2: Run and watch them fail**

```bash
npm test -- session
```

Expected: FAIL — `createSession is not a function`. If instead it fails with `Environment variable not found: DATABASE_URL`, `vitest.setup.ts` is not loading — check `setupFiles` in `vitest.config.ts` and that `.env` exists (`cp .env.example .env`).

- [x] **Step 3: Implement** — the imports go at the top of `src/lib/auth/session.ts`, above the two functions from task 1.1; everything after them goes below.

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

- [x] **Step 4: Run and watch them pass**

```bash
npm test -- session
```

Expected: 11 passed. Note `deleteMany` rather than `delete` in the invalidators — `delete` throws on a missing row, and logging out twice must not be a 500.

- [x] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): create, validate, slide and invalidate database sessions"
```

### Task 1.3: Cookie reading — `getCurrentUser` and `requireUser`

These two call `cookies()` and `redirect()`, which only work inside a request. They are covered by the phase 2 end-to-end walkthrough, not by a unit test — writing a fake request context to unit-test a four-line function is the kind of thing this plan avoids.

- [x] **Step 1: Implement** — append to `src/lib/auth/session.ts`

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

- [x] **Step 2: Verify it compiles and lints**

```bash
npm run lint && npm run build && npm run typecheck
```

Expected: clean.

- [x] **Step 3: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): read the session cookie with getCurrentUser and requireUser"
```

- [x] **Step 4: Announce it**

Post in the team channel: `requireUser()` and `getCurrentUser()` are on `main`, importable from `@/lib/auth/session`. §9 lists this as the W1 D1 blocker for Amir, Alexandre and Adrien. Include the `SessionContext` shape so they can type against it.

---

## Phase 2 — Signup, login, logout, route guard (C2, C3, C11 partial, C12) ✅ except 2.5

> **Tasks 2.1–2.4 done.** PR #13, `dbefd7d` (2026-09-30): `f07b382` schemas, `b1cc507` actions, `f6aa994` forms, `3dfd3cc` guard, `8517338` `docs/testing-auth.md` (manual test guide). **Task 2.5 is still open** (see the task: due now). The exit gate's "the WS ticket route returns a ticket" moves with it. **As shipped:**
> - Everything sits under **`src/app/[locale]/`** (`(auth)/…`, `(app)/…`), because next-intl landed first (PR #12, §C-3 obsolete). The upload action is at `src/app/[locale]/(app)/documents/new/actions.ts`, and `deleteDocument` is at `src/app/[locale]/action.ts`.
> - **Error messages are i18n keys**, not English strings. `AuthFormState.error` and `fieldErrors` are typed as `AuthErrorKey` (`keyof Messages["auth"]["errors"]`), Zod messages are those keys, and `z.flattenError(err, (i) => i.message as AuthErrorKey)` keeps the type. `schemas.test.ts` has two extra tests: every key is translated in `en`/`es`, and only `auth.errors` keys are emitted.
> - Actions redirect with `return redirect({ href: "/", locale: await getLocale() })` from `@/i18n/navigation`.
> - The login rate limiter also prunes expired windows on every failure, so made-up emails cannot grow the Map. `login/actions.test.ts` tests the lock and the 15-minute reset.
> - The nav lives in `src/components/Nav.tsx` (Alexandre's), not in `layout.tsx`. The email and display-name inputs are controlled, because React 19 resets uncontrolled fields after a form action.
> - The `(app)` layout uses `LayoutProps<"/[locale]">`. The dashboard and category page also call `requireUser()` themselves, because a layout does not re-run on client navigation.
> - CSRF evidence (§C-5): a replayed login with `Origin: https://evil.example` is aborted (`docker logs` shows "does not match origin header … Aborting the action") and creates no Session row. Steps are in `docs/testing-auth.md` §B8.

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

- [x] **Step 1: Write the failing test** — `src/lib/auth/schemas.test.ts`

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

- [x] **Step 2: Run and watch it fail**

```bash
npm test -- schemas
```

Expected: FAIL — `Failed to resolve import "@/lib/auth/schemas"`.

- [x] **Step 3: Implement** — `src/lib/auth/schemas.ts`

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

- [x] **Step 4: Run and watch it pass**

```bash
npm test -- schemas
```

Expected: 6 passed.

- [x] **Step 5: Commit**

```bash
git add src/lib/auth/schemas.ts src/lib/auth/schemas.test.ts
git commit -m "feat(auth): add the shared zod schemas for signup and login"
```

### Task 2.2: Signup and login actions

- [x] **Step 1: Write the signup action** — `src/app/(auth)/signup/actions.ts`

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

- [x] **Step 2: Write the login action with rate limiting** — `src/app/(auth)/login/actions.ts`

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

- [x] **Step 3: Write the logout action** — `src/app/(auth)/logout/actions.ts`

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

- [x] **Step 4: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat(auth): add signup, login and logout server actions"
```

### Task 2.3: The forms

- [x] **Step 1: Write the login page** — `src/app/(auth)/login/page.tsx`

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

- [x] **Step 2: Write the signup page** — `src/app/(auth)/signup/page.tsx`

Same structure with three fields. `displayName` uses `autoComplete="nickname"`, `password` uses `autoComplete="new-password"`, the heading is "Create your account", the submit label is "Create account", and the footer links to `/login`.

- [x] **Step 3: Verify the flow by hand**

```bash
npm run dev
```

Open `http://localhost:3000/signup`, create an account, confirm you land on `/`. Then:

```bash
npm run db:studio   # Session table: one row, id is 64 hex chars, not the cookie value
```

Compare the `mp_session` cookie in Chrome DevTools → Application → Cookies against `Session.id`. They must differ. Confirm the cookie is `HttpOnly`.

- [x] **Step 4: Confirm the console is clean**

Graded requirement. Open DevTools → Console on `/login`, `/signup` and `/`. Zero warnings, zero errors — including hydration warnings and missing-key warnings.

- [x] **Step 5: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat(auth): add the login and signup forms"
```

### Task 2.4: The route guard

- [x] **Step 1: Move the protected routes into an `(app)` group**

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/documents "src/app/(app)/documents"
```

A route group in parentheses does not appear in the URL, so `/` and `/documents/new` are unchanged. ⚠ These are shared files — say so in the PR description and tag Amir.

- [x] **Step 2: Write the guard** — `src/app/(app)/layout.tsx`

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

- [x] **Step 3: Fix the unauthenticated upload** — `src/app/(app)/documents/new/actions.ts`

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

- [x] **Step 4: Scope the dashboard query to the owner** — `src/app/(app)/page.tsx`

```ts
const { user } = await requireUser();
const documents = await prisma.document.findMany({
  where: { ownerId: user.id },      // owner-scoped IN THE QUERY, not filtered in the component
  select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});
```

§7 E6's Done-when requires the scoping to live in the query. Filtering an unscoped result in the component is a review failure.

- [x] **Step 5: Add the user and logout button to the nav** — `src/app/layout.tsx`

Read the session with `getCurrentUser()` (not `requireUser()` — the root layout also wraps `/login`, which must render for signed-out visitors). Show `Sign in` / `Sign up` links when it is `null`, and the display name plus a logout `<form action={logout}>` when it is not.

- [x] **Step 6: Verify the guard**

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

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): guard the app routes and attach uploads to the signed-in user"
```

### Task 2.5: WS ticket endpoint (C12) — do this the day Alexandre starts D2

Not part of your four modules; it is C12, and it blocks Alexandre's WebSocket handshake (§9, R4). Two hours. Revised 2026-10-02: there is no fallback secret, and step 6 uncomments a line instead of appending one.

> **Built, in review (2026-10-05).** `60bbe07` on `feat/auth-ws-ticket`, pushed, **PR #22 open**. Steps 1–6 are done; the boxes stay unticked until it merges. **As shipped:**
> - The route uses `Response.json`, like `GET /api/documents/[id]`, so it does not import `next/server`.
> - Compose forwards `WS_TICKET_SECRET: "${WS_TICKET_SECRET:-}"`, so `docker compose up` does not warn when the key is missing from `.env`.
> - Evidence: `npm test` 153/153 (ticket 5/5, three mutants each caught), build and tsc clean. On mespapiers.local: 401 without a cookie, 405 on GET, 200 with a ticket that verifies once and is `null` on replay.
> - **Still to do (step 7):** tell Alexandre the contract below, that `realtime` needs the same `WS_TICKET_SECRET` (`npm run realtime` does not load `.env`; in compose, forward it to the `realtime` service when he adds one), and that nginx has no `/ws` block yet.

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

/** nonce -> expiry. Pruned lazily on use; no timers, so fake timers in tests
 *  and `setTimeout().unref()` typing under lib.dom both stop being a problem. */
const used = new Map<string, number>();

function sign(payload: string): string {
  // Read per call, not at import: `next build` imports the route without the key.
  // No fallback: a default secret in the source lets anyone mint tickets.
  const secret = process.env.WS_TICKET_SECRET;
  if (!secret) throw new Error("WS_TICKET_SECRET is not set");
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

- [ ] **Step 6: Enable `WS_TICKET_SECRET` in `.env.example` and `.env`**

`.env.example` already has `# WS_TICKET_SECRET=change_me_locally` under "Auth / sessions". Uncomment it there, and add a real value to your `.env` (`openssl rand -base64 32`). §0: uncomment a key in the same PR that introduces its service. For the tests, put `process.env.WS_TICKET_SECRET ??= "test-only";` at the top of `ticket.test.ts`, so they do not depend on anyone's `.env`.

**Compose does not forward `.env` to `web`.** It sets only `DATABASE_URL` in `environment:`, and the image picks up `.env` only through `COPY . .` at build time. Add `WS_TICKET_SECRET: ${WS_TICKET_SECRET}` to the `web` service's `environment:` in `docker-compose.yml` (Adrien's file), and to `realtime` when it exists. Phases 8 and 9 need the same for the OAuth keys.

- [ ] **Step 7: Commit and tell Alexandre**

```bash
git add src/lib/auth/ticket.ts src/lib/auth/ticket.test.ts src/app/api/auth/ws-ticket .env.example docker-compose.yml
git commit -m "feat(auth): mint single-use websocket tickets for the realtime process"
```

Tell him: `POST /api/auth/ws-ticket` → `{ ticket }`; call `verifyTicket(ticket)` from `@/lib/auth/ticket` in `src/realtime/server.ts`; it returns `{ userId }` once and `null` on every replay.

---

## Phase 3 — `can()` / `assertCan()` + audit log (C4, C6) ✅

> **Done.** PR #18, `e11c60b` (2026-10-05): `c227302` policy, `64f8b80` audit, `18783f6` drop `AUTH_STUB`, `7894246` `docs/testing-auth.md`, `229f185` truth table, `508bec0` review fixes. **As shipped:**
> - `Action` has **23** members, derived from one `as const` list so the type and the runtime default-deny set cannot drift.
> - `policy.test.ts` has the 14 planned tests, plus "user:manage is admin-only, even on your own account" (found by a mutation check) and a `truth table` block typed `Record<Action, …>`: one row per Action × admin / moderator / member / owner / stranger, so a new Action without a row fails tsc.
> - The final review changed three rules: the vault is owner-only, even for an admin (§C-17); moderation is never granted by ownership (`channel:moderate` and `channel:manageRoles` stop after tier 2); `channel:manageRoles` is admin-only (§C-18).
> - `writeAudit()` types `metadata` as `Prisma.InputJsonObject`, because the plan's `Record<string, unknown>` fails tsc. `audit.test.ts` (2 DB tests) was added. Callers that delete a user must write the audit row first, or the actor FK rejects it silently.
> - C5 run (2026-10-03, Chromium on mespapiers.local): a foreign document read gets 404; a foreign `deleteDocument` gets a **500** (it throws a plain `Error`; Amir's file) and deletes nothing.
> - Still owed: the standup announcement (with §C-17/18) and the phase 5 table sent to Amir. No route calls `can()` or `assertCan()` yet.

**Est:** 1.5d · **Entry gate:** phase 2 exit gate green ✅ (2.1–2.4; 2.5 is not a gate for this phase).
**Exit gate for phase 4:** the truth-table test passes for every `Action` × every role; an unknown action returns `false`; a user with reputation 10 000 gains nothing; posting needs a membership in that channel. **Announce `policy.ts` at standup the day you start**, together with the phase 5 mapping table for Amir's actions. §9 lists it as a blocker for all three teammates.

**Branch:** a new `feat/auth-policy` from `main`. `feat/auth-login` is merged and spent. **Before coding,** expand this phase into `docs/plans/2026-10-0X-c4-c6-policy-and-audit.md` per `CLAUDE.md`. The steps below are already at that level of detail, so the expansion is mostly a copy plus the day's branch state.

**Revised 2026-10-02:**
- a **membership rule** for posting (§C-15). Amir's actions already enforce it in their queries, and private channels make it a policy matter.
- `channel:delete` is **owner-or-admin**, not moderator. It stays out of `MODERATOR_ACTIONS`, as originally written. Amir currently lets any moderator delete; phase 5 aligns his action with the policy.
- **Task 3.3** closes C3 and C5: delete the `AUTH_STUB` line, and record the document-route decision (§C-14).

**Files:**
- Create: `src/lib/auth/policy.ts`, `src/lib/auth/policy.test.ts`
- Create: `src/lib/audit.ts`
- Modify: `.env.example` (remove the `AUTH_STUB` line)

**Interfaces:**
- Consumes: `SessionContext` from `@/lib/auth/session`.
- Produces:

```ts
export type Action = /* the §5 union (23 members as shipped) */;
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

- [x] **Step 1: Write the failing truth-table test** — `src/lib/auth/policy.test.ts`

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

  it("deleting a channel is its creator's call, not a moderator's", () => {
    // Called as { channelId, ownerUserId: channel.createdBy }.
    expect(can(stranger, "channel:delete", { channelId: CHANNEL, ownerUserId: "u-self" })).toBe(true);
    expect(can(moderator, "channel:delete", { channelId: CHANNEL, ownerUserId: "x" })).toBe(false);
    // createdBy is SetNull when the creator is deleted: only an admin can remove it then.
    expect(can(moderator, "channel:delete", { channelId: CHANNEL, ownerUserId: null })).toBe(false);
  });
});

describe("self-service actions", () => {
  it("any signed-in user may act on their own behalf", () => {
    expect(can(stranger, "document:create", {})).toBe(true);
    expect(can(stranger, "channel:create", {})).toBe(true);
    // Public vs private is Channel.isPrivate, checked by the action's query, not here.
    expect(can(stranger, "channel:join", { channelId: OTHER_CHANNEL })).toBe(true);
    expect(can(stranger, "gdpr:export", {})).toBe(true);
  });
});

describe("posting needs a membership in that channel", () => {
  it("a member posts, answers and votes in their own channel", () => {
    expect(can(member, "thread:create", { channelId: CHANNEL })).toBe(true);
    expect(can(member, "answer:create", { channelId: CHANNEL })).toBe(true);
    expect(can(member, "answer:vote", { channelId: CHANNEL })).toBe(true);
    expect(can(moderator, "answer:create", { channelId: CHANNEL })).toBe(true);
  });

  it("nobody posts where they are not a member, or with no channel at all", () => {
    expect(can(member, "thread:create", { channelId: OTHER_CHANNEL })).toBe(false);
    expect(can(stranger, "answer:create", { channelId: CHANNEL })).toBe(false);
    expect(can(stranger, "answer:vote", { channelId: CHANNEL })).toBe(false);
    expect(can(member, "thread:create", {})).toBe(false);
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

- [x] **Step 2: Run and watch it fail** — `npm test -- policy`. Expected: FAIL, module not found.

- [x] **Step 3: Implement** — `src/lib/auth/policy.ts`

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
 *   - pass `channelId`   to mean "a moderator of this channel may also do it",
 *                        and, for posting, "only members of this channel"
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

/** Posting inside a channel: any role, but only in a channel you belong to (§C-15). */
const MEMBER_ACTIONS = new Set<Action>(["thread:create", "answer:create", "answer:vote"]);

/** Any signed-in user, acting on their own behalf, with no resource to own. */
const SELF_SERVICE = new Set<Action>([
  "document:create", "assistant:ask",
  "channel:create", "channel:join",
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

  // Membership — no channelId means no membership can match: denied.
  if (MEMBER_ACTIONS.has(action)) {
    return ctx.memberships.some((m) => m.channelId === resource.channelId);
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

- [x] **Step 4: Run and watch it pass** — `npm test -- policy`. Expected: 14 passed.

- [x] **Step 5: Commit and announce**

```bash
git add src/lib/auth/policy.ts src/lib/auth/policy.test.ts
git commit -m "feat(auth): add the default-deny can/assertCan policy module"
```

Tell the team: `can()` and `assertCan()` are on `main` with the §5 signature plus `Resource.channelId: number` and the membership rule (§C-15). Send Amir the phase 5 mapping table, so `feat/channels` can switch while it is still open. Every inline check he converts before merging is one fewer for phase 5.

**Memberships come from the session, loaded once per request.** A user who joins a channel and posts in the same Server Action has a stale `ctx`. Amir's join and post actions are separate requests, so this does not affect them. If it ever matters, re-run `requireUser()` after the join. Put this in a comment above `MEMBER_ACTIONS`.

### Task 3.2: The audit log writer

- [x] **Step 1: Implement** — `src/lib/audit.ts`

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

- [x] **Step 2: Verify it compiles**

```bash
npm run lint && npm run build && npm run typecheck
```

- [x] **Step 3: Commit**

```bash
git add src/lib/audit.ts
git commit -m "feat(auth): record privileged actions in the audit log"
```

### Task 3.3: Close the C3 and C5 loose ends

- [x] **Step 1: Delete `AUTH_STUB`** (§C-13). Remove the `# AUTH_STUB=0 …` line from `.env.example`. No code reads it, and `CLAUDE.md` already says it does not exist.

- [x] **Step 2: Leave the document call sites as they are** (§C-14). `uploadDocument`, `deleteDocument`, the dashboard, the category page and `GET /api/documents/[id]` are already owner-scoped in the query, which is E6's requirement. Adding `assertCan` after an owner-scoped load is a check that cannot fail, and loading by id alone to run `can()` would let tier 1 hand admins other people's ID papers. The one place `document:read` has to go through `assertCan` is Adrien's assistant context (B10), because it loads documents for a prompt. Tell him.

- [x] **Step 3: C5 evidence.** Add a two-account check to `docs/testing-auth.md`: user B requests user A's `/api/documents/<id>` and gets **404**, and submits `deleteDocument` with A's id and is refused. Run it once, and paste the result into the PR.

- [x] **Step 4: Commit**

```bash
git add .env.example docs/testing-auth.md
git commit -m "chore(auth): drop the unused AUTH_STUB key and document the C5 ownership checks"
```

---

## Phase 4 — Admin surface (C14, first half) — **Module 1 complete**

**Est:** 1d · **Entry gate:** phase 3 exit gate green.
**Exit gate for phase 5:** a non-admin visiting `/fr/admin/users` sees a rendered 403, **not a blank page and not a redirect**, in all three locales; an admin can list, search, promote, demote and delete users; every mutation writes an `AuditLog` row; you cannot demote or delete yourself; only admins see the nav link; the admin page, the 403 card and the nav are usable with no horizontal scroll at 375, 768 and 1440 px.

**Revised 2026-10-06: Rasiol owns the front end too.** Rasiol builds the UI of this phase (the 403 card, the user table, the search box, the buttons and the nav link) and fixes the design and responsive problems it hits, the nav at 375 px included. Alexandre and Amir only review their files (`Nav.tsx`, `prisma/seed.ts`).

**Revised 2026-10-02:** paths are under `src/app/[locale]/(app)/`, strings are in `messages/*.json` under `admin`, `revalidatePath` uses the file pattern, and the seed change (task 4.1 step 2) can go in now that Amir's rewrite of `prisma/seed.ts` is merged (PR #9). **Expand into** `docs/plans/<date>-c14a-admin-surface.md` before starting.

**Files:**
- Create: `src/app/[locale]/(app)/admin/layout.tsx`, `src/app/[locale]/(app)/admin/users/page.tsx`, `src/app/[locale]/(app)/admin/users/actions.ts`
- Modify: `messages/{fr,en,es}.json` (an `admin` namespace; `fr.json` first), `src/components/Nav.tsx` (admin-only link) ⚠ Alexandre's file
- Modify (`feat/channels` is merged): `prisma/seed.ts`, which gets a seeded ADMIN and USER with passwords ⚠ Amir's file

**Interfaces:**
- Consumes: `requireUser`, `can`, `assertCan`, `writeAudit`, `invalidateAllSessions`.
- Produces: no exported interface — this phase is a screen.

**This is where "different views/actions per role" becomes demonstrable for global roles.** The channel-scoped half arrives in phases 5–7.

### Task 4.1: An admin you can log in as

- [ ] **Step 1: Now, for development.** Sign up two accounts at `/fr/signup`, then set `globalRole = ADMIN` on one of them in `npm run db:studio`. This needs no code. It is enough to build and verify the whole phase.

- [ ] **Step 2: Seed them.** Amir's rewrite of `prisma/seed.ts` is merged (PR #9: ten users named `` `${name}@gmail.com` ``). Give one seeded user `globalRole: "ADMIN"` and both a `passwordHash` from `hashPassword()` (import it relatively, `../src/lib/auth/password`, as the seed already does for the Prisma client). **Lowercase the seeded emails.** The login schema lowercases its input, so `Amir@gmail.com` can never match. That is also why today's seeded users cannot log in. Write the dev password in `docs/testing-auth.md`. Then:

```bash
npm run db:reset   # resets AND seeds (prisma.config.ts registers the seed); do not run db:seed after it
```

### Task 4.2: The 403 layout

- [ ] **Step 1: Add the strings.** In `messages/fr.json` add an `admin` namespace with `forbiddenTitle` and `forbiddenBody`. The page's strings come in task 4.3: title, search label, column headers, role names, promote/demote/delete labels, and the empty state. Then add the same keys to `en.json` and `es.json`. `t()` is typed against `fr.json`, so a key missing there fails the typecheck.

- [ ] **Step 2: Write it** — `src/app/[locale]/(app)/admin/layout.tsx`

```tsx
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { can } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

// §C-2: rendered, not thrown. error.tsx does not wrap the layout.tsx of its own
// segment, so a throw here escapes to the root boundary and shows a blank page —
// which C14's "not a blank page" explicitly forbids. Not the boundary either:
// every admin Server Action calls assertCan itself (§C-4).
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const ctx = await requireUser();

  if (!can(ctx, "user:manage", {})) {
    const t = await getTranslations("admin");
    return (
      <Card className="text-center">
        <h1 className="text-xl font-semibold">{t("forbiddenTitle")}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("forbiddenBody")}</p>
      </Card>
    );
  }

  return children;
}
```

The route group does not appear in the `LayoutProps` key: `(app)/admin/layout.tsx` is `"/[locale]/admin"`. `next build` generates the type, so run it once before `typecheck`.

- [ ] **Step 3: The admin link in the nav** — `src/components/Nav.tsx` ⚠ Alexandre's file

Inside the signed-in branch, render `<Link href="/admin/users">` only when `can(ctx, "user:manage", {})`, with a new `nav.admin` key. This is the smallest visible "different view per role", and evaluators look for it. Check the nav at 375 px: the new link adds one more item to the open 375-px overflow issue (worklog). Fix it in this phase (revised 2026-10-06), for example by putting the link in `MobileMenu` below the breakpoint, and tell Alexandre what changed.

- [ ] **Step 4: Verify both roles by hand**

Log in as the plain `USER` and open `/fr/admin/users`, then `/en/…` and `/es/…`: the translated 403 card renders, the page is not blank, and the URL does not change. Log in as the `ADMIN`: the page renders, and the nav shows the link.

### Task 4.3: The user list and role actions

- [ ] **Step 1: Write the actions** — `src/app/[locale]/(app)/admin/users/actions.ts`

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

  // The route FILE pattern: "/admin/users" matches nothing under [locale].
  revalidatePath("/[locale]/(app)/admin/users", "page");
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
  revalidatePath("/[locale]/(app)/admin/users", "page");
}
```

The English `throw` messages and `ForbiddenError` are not i18n keys, deliberately. They are reachable only through a forged request, because the page renders no buttons on your own row and the layout hides the page from non-admins. No `error.tsx` exists, so Next's default error page shows them. Do not add one for this.

`deleteUser` does not check channel moderation: deleting a channel's only moderator is accepted (§C-19).

- [ ] **Step 2: Write the page** — `src/app/[locale]/(app)/admin/users/page.tsx`

A server component with `export const dynamic = "force-dynamic"`. Query with `prisma.user.findMany({ select: { id, email, displayName, globalRole, reputation, createdAt, _count: { select: { documents: true, sessions: true } } }, orderBy: { createdAt: "desc" } })` and render it with `Table`/`TableHead`/`TableBody`/`TableRow`/`TableHeaderCell`/`TableCell` from `src/components/ui/Table.tsx`, with a `Badge` for the role. Every label comes from `getTranslations("admin")`, and dates are formatted with next-intl's `format.dateTime` (time zone `Europe/Paris` is already configured). `searchParams` is a Promise in Next 16: `const { q } = await searchParams`. Each row carries two `<form action={…}>` buttons — promote/demote and delete — bound with `.bind(null, user.id)`. Render no buttons on your own row, since both actions throw for it. Add a `?q=` search filter on email and display name using `contains` with `mode: "insensitive"`.

- [ ] **Step 3: Verify the whole surface**

As the admin: search, promote the plain user to ADMIN, demote them back, then delete a throwaway user. Confirm in `npm run db:studio` that `AuditLog` has one row per action with the right `actorUserId`, `targetId` and `metadata`. Confirm the promoted user's `Session` rows disappeared. Confirm no buttons render on your own row. Confirm the Chrome console is clean. Resize to 375, 768 and 1440 px and check there is no horizontal scroll, that the table stays readable and that the buttons can be reached with Tab. Fix any design or responsive problem before committing.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(app)/admin" messages src/components/Nav.tsx prisma/seed.ts docs/testing-auth.md
git commit -m "feat(admin): add the user list with role management and audit writes"
```

- [ ] **Step 5: Open the PR**

Title: `feat(admin): user management and role administration`. In the description, state the two §C decisions this phase depends on (rendered 403; no global MODERATOR), tag Alexandre to review the `Nav.tsx` link and the 375-px fix, and Amir to review `prisma/seed.ts` (task 4.1 step 2 goes in this PR, since `feat/channels` is merged). Alexandre's `friends` branch also appends a namespace to `messages/*.json`, so whichever merges second resolves a small conflict at the end of those files.

---

## Phases 5–11 — specifications

Per `CLAUDE.md`'s rule: **phases 0–4 carry full TDD steps; phases 5–11 are specified at task level and each is expanded into its own `docs/plans/YYYY-MM-DD-<id>.md` when its gate opens.** Phases 5–7 were rewritten on 2026-10-02. E9–E11 are Amir's (§B), so they now cover only what is yours: putting the policy into his community actions, channel-role management (C14b), and signing off module 2.

### Phase 5 — The policy in the channel actions (C5, C6 in Amir's merged code) · 1d

**Expand into:** `docs/plans/<date>-c5-c6-channel-policy.md`
**Entry gate:** phase 3 merged **and** `feat/channels` merged: **both met on 2026-10-05** (PRs #18 and #9). His PR merged with every check still inline, so the whole table below is still to do.
**Schema:** none. **Files:** Amir's, under `src/app/[locale]/(app)/channels/`. If you write the change, open `feat/channel-policy` and tag him.

**The mapping.** Validation failures (bad id, empty text) can keep their silent `return`. Authorization becomes `assertCan`, called after loading the row it needs.

| Action (file) | Today's check | `assertCan(ctx, …)` | `writeAudit` |
|---|---|---|---|
| `createChannel` (`create/action.ts`) | session only | `"channel:create", {}` | — |
| `editChannel` (`[id]/edit/action.ts`) | `createdBy === user.id` | `"channel:update", { channelId }`. Moderators may edit too, a behaviour change to agree with Amir | yes |
| `deleteChannel` (`[id]/delete/action.ts`; a duplicate is in `create/action.ts`) | MODERATOR membership | `"channel:delete", { channelId, ownerUserId: channel.createdBy }`: creator or admin (phase 3 test) | yes, **before** the delete |
| `joinChannel` (`join/actions.ts`) | `!isPrivate` | `"channel:join", { channelId }`; keep the `isPrivate` check | — |
| `requestJoinChannel` (`join/actions.ts`, default export) | session user, not already a member | `"channel:join", { channelId }` | — |
| `acceptJoinRequest` / `rejectJoinRequest` (`[id]/requests/action.ts`) | MODERATOR membership | `"channel:moderate", { channelId }` (§C-16) | yes |
| `inviteUser` (`[id]/invite/action.ts`) | MODERATOR membership | `"channel:moderate", { channelId }` | yes |
| `kickMember` (`[id]/actions.ts`) / `kickMembers` (`[id]/kick/action.ts`, a duplicate) | MODERATOR membership | `"channel:moderate", { channelId }` | yes |
| `acceptInvite` / `declineInvite` (`invitations/action.ts`) | the invite row for `user.id` | none: the caller's own invite row is the authorization | — |
| `leaveChannel` (`[id]/actions.ts`) | own membership | none: the caller's own row | — |
| `createAnswer` (`[id]/actions.ts`) | membership in the query | `"answer:create", { channelId: thread.channelId }` | — |
| `modifAnswerUser` (`[id]/actions.ts`) | author | `"answer:update", { ownerUserId: answer.userId }` | — |
| `deleteAnswer` (`[id]/actions.ts`) | author only, in the query | `"answer:delete", { channelId, ownerUserId: answer.userId }`: the author, **or a moderator of that channel** (§5) | when actor ≠ author |

| Task | Deliverable | Done when |
|---|---|---|
| 5.1 | Every row of the table applied | no action under `channels/` authorizes with `role === "MODERATOR"`, `role: "MODERATOR"` in a `where`, or `createdBy !==` (role reads for *display* are fine) |
| 5.2 | Audit writes | every "yes" row writes one `AuditLog` row with `channelId` and the target |
| 5.3 | Cross-channel check by hand | a moderator of channel A who replays a kick form with channel B's id is refused; a plain member's kick in A is refused; an admin kicks a member in a channel that has **no moderator** (§C-19: delete its only moderator in the admin surface first) and succeeds; recorded in `docs/testing-auth.md` |

**Review notes for Amir's code** (PR #9 merged; status checked 2026-10-05). Send them with the table:
- ✅ **Fixed before merge:** `requestJoinChannel` now takes `user.id` from `requireUser()`, parses the channel id from `channelId` and awaits the `create`.
- `revalidatePath("/channels")` and `` revalidatePath(`/channels/${id}`) `` match nothing under `[locale]`. Use the file pattern: `revalidatePath("/[locale]/(app)/channels/[id]", "page")`. His bare `redirect` hrefs are fine, because `@/i18n/navigation` localises them. **Still open:** most calls are bare paths.
- **Still open:** `ChannelInvite` and `ChannelJoinRequest` have no `updatedAt` (a review-failure rule). The two `kick` actions and the two `deleteChannel` actions are duplicates: keep one of each. Seeded emails are capitalised, so seeded users cannot log in (task 4.1). **Fixed:** the `npm init` junk is gone from `package.json`.
- **New since merge:** `npm run lint` has 1 error (`react/no-unescaped-entities` in `[id]/requests/page.tsx`) and 12 warnings (unused vars, `<img>`), all under `channels/`.
- `joinChannel` already uses `createMany({ skipDuplicates: true })`, so E9's "idempotent under a double-click, via the constraint" holds. Keep it that way.

### Phase 6 — Channel role management + Helper badge (C14, second half) · 1d

**Expand into:** `docs/plans/<date>-c14b-channel-roles.md`
**Entry gate:** phase 5 green. Task 6.4 also needs Amir's E10 (votes → `User.reputation`).
**Schema:** none.

| Task | Deliverable | Done when |
|---|---|---|
| 6.1 | `setChannelRole(channelId, userId, role)` action | `assertCan(ctx, "channel:manageRoles", { channelId })`: admins only, in any channel (§C-18). Refuses to demote a channel's **last** MODERATOR (Amir's `leaveChannel` refuses every moderator, so leaving never empties a channel). That guard covers demotion only: deleting a user can still leave a channel with **zero** moderators (§C-19), so promoting must work there, and neither the action nor the buttons may assume a moderator exists. Writes `channel:setRole` to the audit log. **Invalidates no sessions:** `validateSessionToken()` re-reads memberships on every request, so the change applies on the target's next request |
| 6.2 | Promote/demote buttons | next to Amir's kick buttons on the channel's member list (`/channels/[id]/kick` today), shown only when `can(ctx, "channel:manageRoles", { channelId })`. Strings go in his `channels` namespace. Agree the placement with him |
| 6.3 | **C14 Done-when, scoped** | an ADMIN promotes a member to MODERATOR in channel A; that user can now kick and accept requests in A, and is refused in B (forged form). Hide/mute join this check in phase 7, once E11 exists |
| 6.4 | Helper badge | `reputation >= HELPER_THRESHOLD`, **derived at render**: no column, no "threshold job" (C14's wording), so it cannot drift. Agree the constant with Alexandre (D14 profile) and Amir (answer list); whoever renders it first owns it. Never in `policy.ts`. "Grants no action" is already phase 3's reputation test |

### Phase 7 — Moderation sign-off (E11 is Amir's) · 0.5d — **Module 2 complete**

**Expand into:** `docs/plans/<date>-e11-moderation-signoff.md`
**Entry gate:** Amir's E11 merged, including his moderation migration (`hiddenAt`/`hiddenById` on `Thread`/`Answer`, `ChannelMember.mutedUntil` or equivalent).
**Schema:** none of yours.

| Task | Deliverable | Done when |
|---|---|---|
| 7.1 | Review E11 for the policy | hide/unhide/mute/unmute call `assertCan(ctx, "channel:moderate", { channelId })` and write an `AuditLog` row with `channelId` and target (C6 + E11). Hidden content comes from a **different query branch** for moderators, not from a CSS class over data already sent to members |
| 7.2 | Mute enforcement | a muted member's `thread:create`/`answer:create` is refused **server-side**. Recommended: add `mutedUntil` to the memberships `select` in `validateSessionToken()` and have `can()` deny `MEMBER_ACTIONS` while it is in the future. That is one field and one line, additive to `SessionContext`, and every posting action gets it for free. Decide with Amir |
| 7.3 | Phase 6.3 completed | the promoted moderator hides and mutes in channel A only |
| 7.4 | **Evaluation demo script** in `docs/testing-auth.md` | one channel, three browsers (admin, moderator, member), three different views and action sets on the same thread |

**Review notes for E10, when it comes:** `Vote.value` is a plain `Int`, so constrain it to `-1 | 1` in the shared Zod module, or a crafted request writes `9999` into someone's reputation. The vote and the reputation change go in **one** `$transaction`. A second vote must `upsert` on `@@id([answerId, userId])`, not duplicate.

### Phase 8 — OAuth 2.0 Google (C7) · 1.5d

**Expand into:** `docs/plans/<date>-c7-oauth-google.md`
**Entry gate:** phase 4 green. Only phase 2 is a technical dependency, and it is merged. Phases 6.4 and 7 wait on Amir's E10/E11, so this is the work for those gaps (§A). `feat/channels` has landed, so do phase 5 before this one.
**Schema:** no migration. `OAuthAccount` exists with `@@unique([provider, providerUserId])`.
**Env:** uncomment `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.example` in this PR, and forward them in the `web` service's `environment:` in `docker-compose.yml` (compose does not pass `.env` through; see task 2.5 step 6).
**Routes:** `src/app/api/auth/…` is not localised (the middleware matcher skips `/api`). The callback creates the session with `createSession()` + `setSessionCookie()`, which works in a Route Handler, and then redirects to `/`. The middleware adds the locale prefix. Failures redirect to `/login?error=oauth`, and the page shows an `auth.errors` key, never the provider's raw message.
**Redirect URI:** build it from `APP_URL` (`https://mespapiers.local/api/auth/google/callback`). It must match the Google console entry byte for byte, and browsers only ever reach the app through nginx.

| Task | Deliverable | Done when |
|---|---|---|
| 8.1 | `src/lib/auth/oauth/pkce.ts` — `createVerifier()`, `challengeFor(verifier)`, `createState()` | S256 challenge is `base64url(sha256(verifier))`, verified against a hand-computed fixture; all three use `node:crypto`, no dependency |
| 8.2 | `GET /api/auth/google/start` | sets `state` and `code_verifier` in **httpOnly, 10-minute, `sameSite: lax`** cookies and redirects to Google's authorization endpoint with `code_challenge_method=S256` |
| 8.3 | `GET /api/auth/google/callback` | a mismatched `state` is rejected; a **replayed** callback is rejected because the callback deletes both cookies before doing anything else; the token exchange sends the `code_verifier` |
| 8.4 | Account resolution | existing `OAuthAccount` → sign in; no account but the email matches a `User` → **link** to that user; neither → create the user with `passwordHash: null` |
| 8.5 | Login page button | "Continue with Google" appears on `/[locale]/login` and `/[locale]/signup`, with its label as a message key in all three locales. It is a plain link to `/api/auth/google/start`, not a form |

**Watch for:** `sameSite: "lax"` on the state cookie, not `strict` — Google's redirect is a cross-site navigation and `strict` drops the cookie, giving a state mismatch on every attempt.

### Phase 9 — OAuth 2.0 GitHub + linking edge cases (C8) · 1d — **Module 3 complete**

**Expand into:** `docs/plans/<date>-c8-oauth-github.md`
**Entry gate:** phase 8 exit gate green.
**Env:** uncomment `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in this PR, and forward them in `docker-compose.yml` as in phase 8.

| Task | Deliverable | Done when |
|---|---|---|
| 9.1 | Generalise phase 8 into `src/lib/auth/oauth/providers.ts` | Google and GitHub are **two config objects** (`authorizeUrl`, `tokenUrl`, `scope`, `fetchProfile`) consumed by shared `start`/`callback` helpers — two objects and two functions, not a provider registry or a factory |
| 9.2 | GitHub routes | sign-in completes end to end |
| 9.3 | GitHub email resolution | GitHub's `/user` often returns `email: null`; the profile fetcher calls `/user/emails` and takes the **primary and verified** address, refusing sign-in when there is none |
| 9.4 | Linking in **both** orders | password account → then GitHub sign-in → one `User` with one `OAuthAccount`; GitHub sign-up → then Google sign-in on the same email → one `User` with two `OAuthAccount` rows. C8's Done-when names both orders explicitly |

**Watch for:** an unverified email from an OAuth provider is an account-takeover vector — anyone can register `your@email.com` on GitHub without proving it. Refuse unverified addresses rather than linking on them.

### Phase 10 — TOTP 2FA (C9) · 1.5d

**Expand into:** `docs/plans/<date>-c9-totp-2fa.md`
**Entry gate:** phase 9 exit gate green (order only; TOTP depends on nothing in OAuth, so swap 8–9 and 10–11 if that suits the week).
**Schema:** ⚠ **the only migration in this plan.** Add `User.recoveryCodes String[]` (SHA-256 digests, not the codes) and `Session.twoFactorVerifiedAt DateTime?`. `User.totpSecret`, `User.totpEnabled` and `Session.twoFactorVerified` already exist. `prisma/` is Amir's directory and his branches carry migrations of their own, so rebase onto `main` and run `npm run db:migrate` on the day you create it; two migrations created in parallel get the order wrong. Amir reviews.
**Deps:** `npm install otpauth@^9.5.2 qrcode@^1.5.4` + `npm install -D @types/qrcode`.

| Task | Deliverable | Done when |
|---|---|---|
| 10.1 | Migration `add_2fa_fields` | applies cleanly; a fresh `db:reset` replays it |
| 10.2 | `src/lib/auth/totp.ts` — `createSecret`, `otpauthUri`, `verifyCode`, `generateRecoveryCodes`, `consumeRecoveryCode` | `verifyCode` accepts a code from the **previous, current and next** 30-second window (`window: 1`) and rejects one two windows out — tested with `vi.setSystemTime`, no live clock |
| 10.3 | Enrollment at `/[locale]/settings/security` (or a section of Alexandre's D14 settings page — agree which) | the QR **scans in a real authenticator app**; `totpEnabled` only flips to `true` after the user submits a valid code, so nobody can lock themselves out by navigating away mid-enrollment |
| 10.4 | Recovery codes | exactly 10 are shown **once**, stored only as digests, and each works **exactly once** — the consuming update removes it from the array in the same query |
| 10.5 | Login second step | when `totpEnabled`, login creates the session but leaves `twoFactorVerified: false` and redirects to `/[locale]/login/2fa`. A session that is `totpEnabled && !twoFactorVerified` counts as **signed out everywhere except that page**. Enforce this in `session.ts` (`getCurrentUser()`/`requireUser()`), the one place every caller goes through, and **not** in the `(app)` layout, which is not the boundary (§C-4). Otherwise the nav would greet a half-signed-in user. The 2FA page reads the pending session through its own small helper |
| 10.6 | Disable 2FA | requires a current code, clears `totpSecret`, `totpEnabled` and `recoveryCodes`, and writes an `AuditLog` row |

**Watch for:** the same rate limit as login must cover the 2FA step, or the second factor becomes a 6-digit brute force. **Move** `tooManyAttempts`/`recordFailure` and their Map from `src/app/[locale]/(auth)/login/actions.ts` to `src/lib/auth/rate-limit.ts`, and import them from both actions. You cannot export them from the actions file, because a `"use server"` module may export only async functions. Key the 2FA limiter by user id, not email. `login/actions.test.ts` already covers the limiter, so it should still pass unchanged after the move.

### Phase 11 — Step-up 2FA on destructive actions (C10) · 0.5d — **Module 4 complete**

**Expand into:** `docs/plans/<date>-c10-step-up-2fa.md`
**Entry gate:** phase 10 exit gate green. Channel delete is Amir's action (merged in PR #9), so apply it there with his review.
**Schema:** none. Phase 10's `twoFactorVerifiedAt` covers it; expose it as `ctx.session.twoFactorVerifiedAt` (additive to `SessionContext`).

| Task | Deliverable | Done when |
|---|---|---|
| 11.1 | `requireFreshTwoFactor(ctx)` in `src/lib/auth/totp.ts` | returns immediately when `!ctx.user.totpEnabled`; redirects to `/[locale]/verify-2fa?next=…` when `twoFactorVerifiedAt` is null or older than **15 minutes** |
| 11.2 | Apply it | `deleteUser` (phase 4) demands a fresh code; so does Amir's `deleteChannel`, done in his file with his review |
| 11.3 | Offer it to teammates | C10's Done-when names **document delete** (`deleteDocument` in `src/app/[locale]/action.ts`) and the **GDPR export** (E12). Both are Amir's files, so tell him the helper exists, and pair on the first call so the redirect-and-return flow is right |
| 11.4 | Re-verification page | submitting a valid code sets `twoFactorVerifiedAt = now()` and returns to `next`; `next` must start with `/` and **not** `//` or `/\`, or it is an open redirect (`//evil.example` is protocol-relative). Pass it to `redirect` from `@/i18n/navigation` so the locale is kept |

---

## Coverage check

Every "To Do" from the four modules (`PROJECT_PLAN.md` §6), mapped to the phase that delivers it. ✅ = merged.

| Module | To Do | Phase |
|---|---|---|
| 1 · Standard user management & auth | Email + password signup/login, hashed and salted | 0.4, 1, 2 ✅ |
| | Sessions, protected routes | 1, 2 ✅ |
| | User CRUD | 2 ✅ (create), 4 (read/update/delete) |
| | Profile & settings: display name, locale, avatar, Helper badge | D14, built by Alexandre, counts here (§6) |
| 2 · Advanced permissions | `can()` / `assertCan()` policy module | 3 ✅ |
| | Admin surface: user list, promote/demote | 4 |
| | Role-based route guards | 2 ✅ (`(app)`), 4 (`/admin` 403) |
| | Audit log writes | 3 ✅ (`writeAudit`), 4 · 5 · 6 · 7 (call sites) |
| | Roles admin / user / moderator | 4 (global), 6 (channel-scoped), §C-1 |
| | Policy applied to the community actions | 5 |
| | Different views/actions per role | 4 (admin vs user, nav link), 7.4 (admin / moderator / member demo) |
| | Helper is a badge, not a tier | 3 ✅ (test), 6.4 (badge) |
| 3 · OAuth 2.0 | Authorization-code + PKCE for Google | 8 |
| | Same for GitHub | 9 |
| | Callback routes | 8, 9 |
| | Account linking when the email exists | 8.4, 9.4 |
| 4 · 2FA | TOTP enrollment with QR | 10.3 |
| | Verification with drift | 10.2 |
| | 10 single-use recovery codes | 10.4 |
| | Step-up on destructive actions | 11 |
| *(Domain C hygiene)* | C11 rate limit · CSRF · rotation on login | 2 ✅ |
| | C11 rotation on privilege change | 4 (`invalidateAllSessions` on a global-role change) |
| | C5 ownership guards on documents | 2 ✅ (owner-scoped queries), 3.3 ✅ (evidence, §C-14) |
| *(teammate unblock)* | WS ticket endpoint (C12) | 2.5, PR #22 open |
| *(Amir's module)* | Organization system: E9 channels, E10 threads/votes, E11 moderation | Amir; policy hooks in 5–7 |

**Deliberately out of scope of this plan:** C13 (the OWASP / `npm audit` / `gitleaks` security review) is a week-5 task with no code dependency. Findings to carry into it: there is no `.dockerignore`, so the Dockerfile's `COPY . .` bakes `.env` and its secrets into the `web` image.

**Total:** phases 0–3 and task 2.5 are done (≈ 5.75d; 2.5 awaits review). Remaining: 4 (1d) + 5 (1d) + 6 (1d) + 7 (0.5d) + 8 (1.5d) + 9 (1d) + 10 (1.5d) + 11 (0.5d) ≈ **8d**, so ≈ **14d** in all against §7's 15-day Domain C budget. The original plan was 15.5d plus a 4-day E9–E11 overhang; that overhang is now Amir's, as §7 always intended.
