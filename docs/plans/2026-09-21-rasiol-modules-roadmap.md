# Rasiol's Four Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Rasiol's four graded modules from `PROJECT_PLAN.md` §6 — standard user management & authentication (major), advanced permissions (major), OAuth 2.0 (minor), TOTP 2FA (minor) — in the order the current codebase actually permits, unblocking three teammates as early as possible. The organization system (channels, E9–E11) is **Amir's** module; this plan only puts the policy into it (phases 5–7, revised 2026-10-02). Since 2026-10-19 it also builds module 1's profile side (D14 and friends' online status, phase 12, §C-22).

**Architecture:** Database-backed opaque sessions (random token in an httpOnly cookie, only its SHA-256 stored), one synchronous default-deny `can()` policy function resolving three tiers (global admin → channel moderator → resource owner), and Server Actions that each call `requireUser()` then `assertCan()`. No auth in middleware, no auth library, no service layer — plain functions in `src/lib/auth/`.

> **Status (revised 2026-10-26):** phases **0–6, 12 and task 2.5 are done and merged** (PRs #10, #13, #18, #22, #24, #33, #34 and #38). Phase 7 is cut (§C-21), so **Module 2 is complete** (PR #34, merged 2026-10-19), and **Module 1 is complete** since phase 12 merged (PR #38, 2026-10-23; `main` = `d47f258`). PRs #26, #27 and #29 followed up on phase 4's nav and responsive layout. Since PR #31 (2026-10-14), Alexandre's realtime server verifies task 2.5's ticket on connect, and since PR #36 (2026-10-21) it authorises topic subscriptions. Amir's GDPR work merged on 2026-10-20 (PR #30, with Rasiol's review fixes from PR #37). **Phase 8** (OAuth Google), expanded on 2026-10-26 into [`2026-10-26-c7-oauth-google.md`](2026-10-26-c7-oauth-google.md), is **built and reviewed on `feat/oauth-google`** (gates green, B15 passed, the final review's fixes in; see its *As built*); its PR is next. Open teammate PRs: #35 (Amir, `correction`) and #39 (Alexandre, `feat/realtime-publish`), see §A, *In flight*. Code in the done phases is the plan as written; each one opens with an *As shipped* note listing where the merged code differs. Phases 5–11 were rewritten on 2026-10-02 against `[locale]` routes, i18n keys and Amir's `feat/channels`, and checked against `main` and the open branches on 2026-10-20. `handoff/WORKLOG.md` remains the day-to-day progress log.

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

### What exists today (2026-10-26, `main` = `d47f258`, after PR #38)

Gates on `main`, 2026-10-26: lint 0/0, `i18n:check` the 5 known unused keys, `npm test` 182 of 262 (the other 80 need the DB, which was down: Docker's WSL integration off). The last full run, 262/262 (24 files), was phase 12's on 2026-10-22.

- **Auth core, merged:** `src/lib/auth/password.ts` (argon2id), `session.ts` (§5's interface plus `memberships`, 30-day sessions that never slide, cookie `mp_session` always `Secure`), `schemas.ts` (shared Zod, error messages are `auth.errors.*` keys), `ticket.ts` (task 2.5, PR #22), `rate-limit.ts` (`createRateLimiter()`, moved out of `login/actions.ts` by Amir in PR #30; login keys it by email, `deleteAccount` by user id). Tests: `password`, `session`, `schemas`, `ticket`, `login/actions.test.ts` (rate limit) and `admin/users/actions.test.ts`.
- **Policy and audit, merged (PR #18):** `policy.ts` (`can`, `assertCan`, `ForbiddenError`, 23 actions) and `audit.ts` (`writeAudit`). **Call sites:** phase 4's (the admin layout, page and actions, and `Nav.tsx`'s admin link), phase 5's (PR #33: Amir's channel actions and the pages that hold their forms) and phase 6's (PR #34: `setChannelRole`, the kick page's role buttons, the `/channels` menu).
- **Profile side of module 1, merged (phase 12, PR #38):** `/[locale]/users/[id]` (anyone's profile, a 404 across a block; your own has the name and avatar forms), `GET /api/users/[id]/avatar`, the `Avatar` primitive, `User.lastSeenAt` and friends' online dots (*last seen*, not live), `UserAvatar`. `User.avatarKey` is still unused. `LocaleSwitcher` changes the URL only, so `User.locale` is never written.
- **OAuth: nothing on `main`.** Google sign-in is built on `feat/oauth-google` (phase 8, not pushed): `src/lib/auth/oauth.ts`, `/api/auth/google/{start,callback}`, `GoogleButton`; `.env.example` lists the Google keys and compose forwards them and `APP_URL`. `OAuthAccount` and the nullable `User.passwordHash` were already there.
- **Routes:** `src/app/[locale]/(auth)/{login,signup,logout}`, and the `(app)` group whose `layout.tsx` calls `requireUser()`. The dashboard, the category page, the document page (`documents/view/[id]`), `uploadDocument`, `deleteDocument` (`src/app/[locale]/action.ts`), `GET /api/documents/[id]` and `POST /api/documents/[id]/assistant` each call `requireUser()`/`getCurrentUser()` and scope by `ownerId`. A foreign document id gives 404. The admin surface (phase 4) is at `/[locale]/admin/users`. The account links are in Alexandre's `UserMenu` dropdown and the ☰ panel.
- **i18n:** `next-intl`, `fr`/`en`/`es`, `localePrefix: "always"`, `src/middleware.ts` (locale routing only). `Locale` is exported from `src/i18n/config.ts`.
- **WS ticket, merged (PR #22) and in use (PR #31):** `POST /api/auth/ws-ticket`. Since Alexandre's PR #31 (2026-10-14), `src/realtime/server.ts` reads `?ticket=` from the upgrade URL in `verifyClient` and calls `verifyTicket()`: no ticket, a forged one or a replay gets a 401.
- **Missing:** OAuth, TOTP. `AUTH_STUB` was never built, and phase 3 removed it from `.env.example`. No `error.tsx` and no `not-found.tsx` anywhere, so an unknown URL gets Next's default English 404 with no nav.
- **Merged from teammates:**
  - Amir's `feat/channels` (PR #9, 2026-10-05) covers most of E9: channel create/edit/delete, public join, private channels with invites and join requests, kick, leave, plus answer create/edit/delete. It added three migrations (`ChannelInvite`, `ChannelJoinRequest`, `Channel.isPrivate`) and **rewrote `prisma/seed.ts`**. Every check in it was inline (`role === "MODERATOR"`, `createdBy !== user.id`), with a silent `return` on refusal; phase 5 (PR #33) turned them into `assertCan`. E10 (votes) and E11 (hide/mute) are not started.
  - Alexandre's `src/contracts/events.ts` (PR #15) and a `ws` server in `src/realtime/` (PR #16), authenticated on connect since PR #31 and with authorised topic subscriptions since PR #36 (both below). Nothing publishes to the topics yet: `src/lib/realtime/publish.ts` is a stub. His friends feature (PR #23, 2026-10-06): `src/lib/friends/`, `(app)/friends/`, and the `UserMenu` account dropdown.
  - Adrien's `src/lib/ai/extract.ts` (PR #20), called by `classifyDocument()` on upload, and the `add_document_deadline` migration. His assistant (PR #25, 2026-10-07): `src/lib/ai/assistant.ts` (`streamAssistant()`), the SSE route `POST /api/documents/[id]/assistant`, and the document page with its chat. The route loads the document with an owner-scoped `findFirst`, not `assertCan` (see §B).
- **Merged on 2026-10-12:** **PR #28** (Amir, `chore/review-fixes`, squash-merged by Rasiol as `e0e00df`): answers phase 5's review notes. One kick action (`[id]/kick/action.ts` `kickMembers`, with the stricter checks of the removed `kickMember`) and one `deleteChannel` (`[id]/delete/action.ts`); a migration adding `updatedAt` to `ChannelInvite` and `ChannelJoinRequest`; the join-requests page translated (lint goes to zero); `deleteDocument` stops throwing (owner-scoped `deleteMany`, then a redirect); a *Channels* link in the nav (bar only; **PR #29**, Rasiol, `9ba37f2`, moved it into `AccountLinks`, so it is in the dropdown and the ☰ panel). Review findings are in phase 5.
- **Merged on 2026-10-14:**
  - **PR #31** (Alexandre, `realtime-handshake`, `0a06314`): `src/contracts/socket.ts` (`ServerMessage`, `ClientMessage`, `parseTopic`, a Zod `parseClientMessage`), `src/realtime/handshake.ts` (`readTicket()`), and the ticket check in `verifyClient`; a connected client gets `{ type: "hello", userId }`. `main.ts` loads `.env` through `dotenv` and exits at startup without `WS_TICKET_SECRET`; `.env.example` gains `REALTIME_PORT` and `HEARTBEAT_MS`. Still his to do: the server ignores client messages (`parseClientMessage` is not wired, so no subscribe; done in PR #36), there is no `realtime` service in compose, and nginx has no `/ws` block.
  - **PR #32** (Adrien, `admin/privacy-and-terms`, `e4f597d`): `/[locale]/privacy` and `/[locale]/terms` in a `(public)` group, open signed out, and `src/components/Footer.tsx` in the root layout linking both. The graded "accessible Privacy Policy and Terms pages" line is met. PR #30 then pointed its rights section (`privacy.rights.howTo`, `terms.termination.body`) at `/account/data`.
- **Merged on 2026-10-16 and 2026-10-19:** **PR #33** (phase 5, `8bf5fcd`) and **PR #34** (phase 6, `70ba217`), both Rasiol's, reviewed by Amir. PR #34 carries Amir's review fix (§C-20: the creator deletes a channel only while they moderate it, `19e222d`). The remote `feat/channel-policy` and `feat/channel-roles` are deleted.
- **Merged on 2026-10-20:** **PR #30** (Amir, `feat/gdpr`, `0f48131`, E12–E13), after Rasiol's review fixes went into it as **PR #37** (`fix/gdpr-export`, `b7dc524`). `/[locale]/account/data`, linked from `AccountLinks` (*Mes données*). `POST /api/account/export`, a plain form `POST` from that page: an in-memory ZIP of `data.json` plus the original files, built before the mail and the `gdpr:export` audit row. `deleteAccount` re-asks the password, shares `createRateLimiter()` with login, runs its last-admin guard in the delete's transaction with the admin rows read `FOR UPDATE`, and mails and audits (`gdpr:delete`) once per deleted account; threads and answers stay, their author nulled (`onDelete: SetNull`). `src/lib/mail.ts` (Nodemailer) and a pinned Mailpit in compose; adds `jszip` and `nodemailer`. Relevant to phase 8 (an OAuth-only user cannot confirm a deletion), phase 10 (the limiter already lives in `rate-limit.ts`), 11.3 (the export) and phase 12 (the export does not include the avatar).
- **Merged on 2026-10-21:** **PR #36** (Alexandre, `realtime-topic`, `5a6b3b5`, merged by Rasiol as is after his read-only review; the rest of plan D2): the server handles `subscribe` / `unsubscribe`. A socket starts on its own `user:<id>`, may not subscribe to anyone else's, and may subscribe to `channel:<id>` only as a member (`canSubscribe()` in `handshake.ts`, the DB check `isChannelMember()` in `membership.ts`; a refused or failed check is a `forbidden`, not a crash; a bad message is a `badRequest`). Two review points left for the publish PR: membership is checked only at subscribe, so a kicked or departed member keeps the channel topic until reconnect, and a `subscribe` + `unsubscribe` pair can end subscribed (the DB check resolves after the unsubscribe). Not required: a `maxPayload` (ws's default is 100 MiB) and `userTopic()` instead of the `user:${userId}` literal. Still no publishing, no presence, no `realtime` service in compose, no nginx `/ws`. Relevant to phase 12's live-dot hand-off (decision 12-A).
- **Merged on 2026-10-23:** **PR #38** (Rasiol, `feat/profile`, `d47f258`, merged by Amir): phase 12, with the final review's fixes (`449fd40`: the avatar in the GDPR export, the photo and the online status in the privacy policy, `sendRequest` returning `notFound` on P2003).
- **In flight, not merged (checked 2026-10-26 with `git fetch --prune` and the public PR API; `gh` is still logged out; both merge into `main` with no conflict):**
  - **`feat/realtime-publish`, PR #39** (Alexandre, 13 commits to 2026-10-25, not reviewed): the WS server on a `node:http` server with an internal `POST /publish` (`REALTIME_PUBLISH_SECRET`, `REALTIME_INTERNAL_URL`; `.env.example` drops `REDIS_URL`), `publish.ts` implemented, `member.left` unsubscribes the socket, 4 KB socket messages and 64 KB publish bodies, friends' presence. No compose service, no nginx `/ws`. Its review takes PR #36's two points (below).
  - **`correction`, PR #35** (Amir, opened 2026-10-19, no description; `8a8815e`, `a1cfe3d` (a merge of `b548851`), `b67ecf4` (2026-10-21: no emails in the invite page's user list, the `(app)` group added to its `revalidatePath()` patterns), and on 2026-10-23 `29012b2` (merge `main`, phase 12 included), `42b4fa1` (npm log lines out of `init`), `0757a84` (uploads import `sniffMime()` from `src/lib/files/sniff.ts`) and `3ae9e73` (the last-moderator notice removed, in line with §C-20); it also hardens `GET /api/documents/[id]`: a type allow-list, `nosniff`, a CSP): upload magic bytes, channel close and join requests, and a **DB consolidation**. It touches this plan in two places, so Rasiol reviews it. (1) It edits `src/lib/audit.ts` and makes `AuditLog.channelId` an `Int?` foreign key with `onDelete: SetNull`, which reverses §C-8; `deleteChannel` now writes its audit row **before** the delete, which reverses phase 5's "after, only when it removed the row". It is consistent (the tests are updated; `targetId` keeps the channel id once `channelId` is nulled), but it is a decision to accept or refuse, and to record. (2) It deletes the seven applied migrations after `init` and renames `init` to `20261019000000_init`, so every existing database reports drift and needs `npm run db:reset`; create phase 10's migration only after it merges (phase 12's goes in either way, decision 11 of its plan). It also adds `CHECK (value IN (-1, 1))` on `Vote.value` (phase 7's E10 note), `Channel.isClosed`, `@@unique([ownerId, fileHash])` on `Document`, and `@unique` on `Thread.channelId` (one thread per channel: ask Amir whether that is intended). No hide, mute or vote action. Three more points for its review (found 2026-10-20): it deletes the `documents/error-*` pages and their `documentErrors` keys, so a wrong file type or a duplicate upload now returns with no message; it caps AI extraction at 20 uploads per user per day (plan B7, Adrien's); and the channel page replaces *Leave* with a "promote someone before leaving" notice for the last moderator, while `leaveChannel` and the `/channels` menu still let them leave, which reads against §C-20. Its conflicts with `main` are resolved (`d108789`, `29012b2`); its migrations are now `20261019000000_init` and phase 12's `20261022115507_add_profile`.

### The blocking dependencies, in order

| # | Piece | Blocks | Status |
|---|---|---|---|
| 1 | Vitest + `zod` + `@node-rs/argon2` | every task | ✅ phase 0 |
| 2 | `session.ts`: `requireUser()` and friends | everything, and 3 teammates | ✅ phase 1, used by Amir's branch |
| 3 | Login / signup + the `(app)` guard | phases 3–11 | ✅ phase 2 |
| 4 | **`policy.ts`: `can()` / `assertCan()`** | modules 1–2, and 3 teammates | ✅ phase 3 (PR #18). Used by the admin surface (phase 4), and by Amir's channel actions since phase 5 (PR #33) and phase 6 (PR #34). |
| 5 | **`writeAudit()`** | admin surface, moderation | ✅ phase 3 (PR #18) |
| 6 | Amir's `feat/channels` merged | phase 5 (policy in his actions), phase 6 (channel roles) | ✅ PR #9 (2026-10-05) |
| 7 | Amir's E10 (votes, reputation) and E11 (hide/mute) | nothing of yours since phase 7 was cut (§C-21); review notes in phase 7 | not started (checked 2026-10-19: no hide, mute or vote action on any branch) |
| 8 | Amir's PR #35 merged (it replaces every migration with one `init`) | phase 10's migration (phase 12's went in on the current history, PR #38) | open since 2026-10-19; merges into `main` with no conflict (2026-10-26) |

### Module order

```
Phase 0–2  tooling · session core · login/guard ✅      merged (PRs #10, #13)
   │
Phase 3    can() + audit (C4, C6) ✅                    merged (PR #18)
   │
Phase 4    admin surface (C14a) ✅                      merged (PR #24); module 1 reopened 2026-10-19 (§C-22)
   │
   ├──────────────────────────────────────┬──────────────────────────────────────
   │ Track A — Amir's channel code        │ Track B — your own code
   │ Phase 5   policy in channel  MERGED  │ Phase 12  profile · avatar · online  MERGED → MODULE 1
   │ Phase 6   channel roles      MERGED  │ Phase 8   OAuth Google (C7)  ← built, PR to come
   │           → MODULE 2 done            │ Phase 9   OAuth GitHub (C8)  → MODULE 3
   │ Phase 7   CUT (§C-21)                │ Phase 10  TOTP (C9)
   │                                      │ Phase 11  step-up (C10)      → MODULE 4
```

Phase 12 goes first because it reopens a **major** (2 points), while phases 8–11 are two minors. Start with the parts that need no migration (12.1, the profile page; 12.2, the edit form). The migration then goes after Amir's PR #35 if it has merged, otherwise on the current history (row 8 above).

**The load-bearing observation (revised 2026-10-19):** phases 5 and 6 had the critical path, because permissions is 2 of your 6 points and its graded demo, "different actions per role", needed the channel tier. Both merged (PRs #33 and #34). Phase 7 is cut (§C-21). What is left depends only on phase 2, except the timing of phase 12's and phase 10's migrations (Amir's PR #35).

**Module 1 (user management & auth)** has signup, login, sessions and the admin user list since PR #24 (2026-10-07). The subject's four other lines for it (update the profile, upload an avatar, see friends' online status, a profile page) were D14, Alexandre's in `PROJECT_PLAN.md`; since 2026-10-19 they are Rasiol's, as phase 12 (§C-22). **Module 1 is complete since phase 12 merged** (PR #38, 2026-10-23). **Module 2 (advanced permissions)** is complete since PR #34 (2026-10-19): the channel-moderator tier is appointed by an admin and in use in real channels (B13). Phase 7 was cut on 2026-10-19 (§C-21).

---

## B. Teammate dependencies

### What you owe them (and when it stops hurting)

| Deliverable | Phase | Who is blocked | Note |
|---|---|---|---|
| `requireUser()` / `getCurrentUser()` | 1 | Amir, Adrien, Alexandre | ✅ merged, and already in use on `feat/channels` |
| `can()` / `assertCan()` | 3 | Amir (his channel actions), Alexandre (WS topic authz), Adrien (assistant context) | ✅ PR #18. Still owed: the standup announcement (§C-17 and §C-18 change what a published interface means) and the phase 5 mapping table for Amir. Adrien's assistant (PR #25) loads its document with `findFirst({ where: { id, ownerId } })` instead of `assertCan`. Since §C-17 both refuse exactly the same callers (§C-14's reasoning), so nothing is owed there. |
| WS ticket + `verifyTicket()` | 2 (task 2.5) | Alexandre (D2 handshake) | ✅ PR #22 (2026-10-06), in use since his PR #31 (2026-10-14): `verifyClient` calls `verifyTicket()` on the upgrade URL's `?ticket=`, and `main.ts` loads `.env` itself. Nothing owed. A `realtime` service in compose (forward `WS_TICKET_SECRET` to it) and the nginx `/ws` block are his. |
| Channel-role management (C14b) | 6 | Amir's moderators can only be the channel creator until it exists | ✅ PR #34 (2026-10-19) |
| The avatar route's URL | 12 | nobody; Alexandre and Amir may want avatars in their lists | ✅ `GET /api/users/[id]/avatar` (PR #38). Nothing to build for them |

### What you need from them

| Need | Owner | Blocks | Status |
|---|---|---|---|
| `components/ui` primitives | Alexandre (D0) | — | ✅ in `src/components/ui/` |
| `app/[locale]/` + `next-intl` (D10, D11) | Alexandre | — | ✅ PR #12. All new routes go under `[locale]`; §C-3 is obsolete. |
| `DocumentCategory` | Amir | — | ✅ PR #11. `Document.version` is still missing, and nothing of yours needs it. |
| `feat/channels` merged | Amir | phases 5 and 6 | ✅ PR #9 (2026-10-05). The review notes still open are in phase 5. |
| E10 votes/reputation, E11 hide/mute | Amir | nothing since §C-21 (phase 7 cut); review his PRs with phase 7's notes | not started (checked 2026-10-19) |
| E12 GDPR export, E13 deletion | Amir | 11.3 (step-up on the export) | ✅ PR #30 (merged 2026-10-20, `0f48131`): §A, *Merged on 2026-10-20* |
| A migration slot in `prisma/` | Amir | 10.1; 12.3 and 12.4 only in timing | 10.1 after his PR #35 merges (it squashes every migration into one `init`); phase 12's goes in either way (decision 11 of its plan) |
| Presence from the realtime server (D3) | Alexandre | nothing: 12-A settled on *last seen*; the live dot is a later hand-off | friends' presence is in his PR #39 (open, 2026-10-25); the dot does not use it yet |
| Redis | Adrien | nothing of yours | The login limiter and the WS nonce set are in-process Maps. |

### Ownership: E9–E11 are Amir's (resolved in practice; write it down)

`PROJECT_PLAN.md` §6 gives the organization module to Amir, and §7 gives him E9, E10 and E11. He built E9 on `feat/channels` (PR #9, merged 2026-10-05). The original roadmap claimed them for phases 5–7. That claim is dropped, and phases 5–7 below now cover only your share: the policy (C4/C5/C6) applied to his actions, and channel-role management (C14b). **Action:** add one dated line to `MEETING_DISCUSSION.md` so the decision is visible to the team, not only to this file.

### Ownership: D14 is Rasiol's (since 2026-10-19)

`PROJECT_PLAN.md` §6 counted D14 (profile & settings) toward Rasiol's user-management module but had Alexandre build it, and §8 never scheduled it in any week. On 2026-10-19 Rasiol took it, together with friends' online status: phase 12 and §C-22. `PROJECT_PLAN.md` §6, §7 and §8 are updated to match. Alexandre keeps the friends feature (D15, merged in PR #23) and the realtime server; phase 12 touches his `friends/page.tsx` only to show the online dot, with his review. **Action:** the same dated line in `MEETING_DISCUSSION.md` can record both.

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

*Added 2026-10-18, from the phase 6 review:*

20. **Demoting a channel's last moderator is allowed, and `channel:delete` needs the creator to still moderate the channel.** Task 6.1 used to refuse demoting the last moderator. That guard was cut. §C-19 already accepts a channel with no moderator: an admin moderates every channel and can promote someone again. A count-then-update guard also races (two demotes at once both see two moderators) unless it is wrapped in a transaction, and a refusal the user can reach needs its own i18n error. The case for allowing it (Amir asked for one in his PR #34 review): the only moderator of a channel abuses the role, and the admin must take it away before a successor is found; refusing would force the admin to promote someone arbitrary first, or to delete the account, which already leaves the channel with no moderator (§C-19). **`channel:delete` (changed 2026-10-19, Amir's PR #34 review):** this section first kept `channel:delete` on ownership alone (`ownerUserId: channel.createdBy`, phase 5), so a demoted creator could still delete, and once moderators could leave, so could a creator who had left, by typing the URL. Amir's review rejected both: a demotion takes away every right on the channel. `can()` now grants `channel:delete` to the creator only while they hold a `MODERATOR` membership in that channel (admins still pass at tier 1). Leaving, or a demotion, ends it, and then only an admin may delete; a re-promotion gives it back. The three callers (the action, the delete page, the `/channels` menu) already passed `{ channelId, ownerUserId }`, so none changed. Only Amir's channel code asks `channel:delete`, so this is a team announcement, not a team decision. **Also (final review, 2026-10-18, Rasiol's decision): any moderator may leave a channel**, the creator included. Amir's `leaveChannel` refused every moderator so that a channel never lost its moderators; with this section and §C-19 that state is accepted, and the refusal left an admin-appointed moderator stuck, against vision §3 ("everything a Member can do").

*Added 2026-10-19, from the phase 7 review (Rasiol: "keep only the necessary"):*

21. **Phase 7 is cut, and Module 2 closes with phase 6.** Every task in it was either already done or someone else's work, and its entry gate tied this module to three teammate deliverables (E10, E11, D14), none of them started. The subject's three lines for this module are met by phases 4–6: user CRUD (`/admin/users`, B11), roles admin / user / moderator (global roles in phase 4, the channel moderator in phase 6), different views and actions per role (B11 for admin vs. user; B13 shows member, admin, appointed moderator and creator on one channel). What each phase 7 task became:
    - **Hide and mute** (7.1–7.3) are E11, in Amir's organization-system module. They plug into `channel:moderate`, which `policy.ts` already has, scoped to one channel and in the truth table. Reviewing his PR is ordinary review, so the checks moved to phase 7's review notes. C14's "gains hide/mute only there" is met with kick, the moderator action that exists: B13 row 6, and the cross-channel replay test from phase 5.
    - **The demo script** (7.4) is B11, then B13, then B12's forged kick (row 3) in `docs/testing-auth.md`.
    - **The Helper badge** (7.5): its permission half, "a Helper gets no extra permission" (C4), is phase 3's test *reputation is a badge, not a tier*. Showing the badge was D14's, which the vision counts toward module 1 (D14 is Rasiol's since §C-22, but phase 12 leaves the badge out until E10 writes `reputation`). C14's "threshold job" is not built: whoever renders the badge first computes `reputation >= threshold` at render.

    If an evaluator asks to *edit* a user from the admin surface, the admin edits the role; display names are changed by their owner on the profile page (phase 12).

*Added 2026-10-19, when the profile work moved to Rasiol:*

22. **D14 (profile & settings) is Rasiol's, and module 1 is not complete without it.** `PROJECT_PLAN.md` gave D14 to Alexandre, credited to this module (§6), and never scheduled it (§8). The subject's major for this module has four lines that phases 0–4 do not cover: users update their profile information; users upload an avatar, with a default one when they have none; users add friends **and see their online status** (friends are Alexandre's PR #23; the online status is not built); users have a profile page showing their information. On 2026-10-19 Rasiol took all four: **phase 12**. What it keeps from D14: display name, avatar (replaced on each upload, served through an authorised route), online indicators. What it leaves out: the Helper badge (nothing writes `reputation` before E10; the phase 7 note applies to whoever renders it), and live push of online changes (12-A picked *last seen*). Locale persistence to `User.locale` is D10's (Alexandre), and phase 12 does not need it. **Two departures, settled in phase 12's expansion** ([`2026-10-19-d14-profile.md`](2026-10-19-d14-profile.md)): the avatar bytes live in a separate `UserAvatar` table in Postgres, not behind a storage interface (12-B: no `src/lib/storage/` exists, and the team keeps files in Postgres, `MEETING_DISCUSSION.md`), and "online" means seen in the last 5 minutes, not live (12-A; the live dot is a later hand-off to Alexandre's realtime server).

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
├─ rate-limit.ts                          ✅ createRateLimiter(), moved out of login/actions.ts by Amir (PR #30); P10's 2FA step makes its own
├─ ticket.ts                              P2.5 ✅ WS ticket mint/verify (C12, Alexandre)
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
├─ (app)/admin/layout.tsx                 P4 ✅ 403 render, not throw (§C-2)
├─ (app)/admin/users/{page,actions,actions.test}  P4 ✅
├─ (app)/channels/                        ⚠ Amir's (PR #9). P5 ✅ swaps his checks for assertCan, P6 ✅ adds the role buttons
├─ (app)/users/[id]/page.tsx              P12  profile page (yours: edit forms; anyone else's: read-only)
├─ (app)/friends/page.tsx                 ⚠ Alexandre's. P12 adds the online dot
├─ (app)/account/data/                    ⚠ Amir's (PR #30 ✅): GDPR export + deleteAccount
├─ (app)/account/security/                P10  TOTP enrollment (phase 12 plan, decision 4)
└─ (app)/verify-2fa/page.tsx              P11  step-up re-verification

src/lib/users/schemas.ts                  P12  the profile form's Zod module (reuses signup's displayName rule)
src/app/api/users/[id]/avatar/route.ts    P12  the authorised avatar route (signed-in only, nosniff)

src/app/api/auth/                         not localised (the middleware matcher skips /api)
├─ ws-ticket/route.ts                     P2.5 ✅
├─ google/{start,callback}/route.ts       P8
└─ github/{start,callback}/route.ts       P9

src/components/{Nav,UserMenu,MobileMenu}.tsx  ⚠ Alexandre's. P4 ✅ admin-only link, in the UserMenu dropdown and the ☰ panel. P12 adds the profile link to AccountLinks
messages/{fr,en,es}.json                  every phase with UI: fr.json first (it types t())
```

**Two schema migrations** remain in this plan: **phase 12** (`add_profile`: a `UserAvatar` table and `User.lastSeenAt`) and **phase 10** (2FA columns). The hide and mute columns are Amir's to add as part of E11. `prisma/` is Amir's directory, so he reviews both. `main` has eight migrations, and his PR #35 squashes them into one `init` (§A, *In flight*). Create phase 10's after it merges. Phase 12's goes in either way: its SQL only adds things, and its timestamp sorts after `20261019000000_init` (decision 11 of its plan).

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

## Phase 2 — Signup, login, logout, route guard (C2, C3, C11 partial, C12) ✅

> **Tasks 2.1–2.4 done.** PR #13, `dbefd7d` (2026-09-30): `f07b382` schemas, `b1cc507` actions, `f6aa994` forms, `3dfd3cc` guard, `8517338` `docs/testing-auth.md` (manual test guide). Task 2.5 merged later, in PR #22 (2026-10-06), which closed the exit gate's "the WS ticket route returns a ticket". **As shipped:**
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

> **Done.** PR #22, `74542bd` (merged 2026-10-06): one commit, `60bbe07`. **As shipped:**
> - The route uses `Response.json`, like `GET /api/documents/[id]`, so it does not import `next/server`.
> - Compose forwards `WS_TICKET_SECRET: "${WS_TICKET_SECRET:-}"`, so `docker compose up` does not warn when the key is missing from `.env`.
> - Evidence: `npm test` 153/153 (ticket 5/5, three mutants each caught), build and tsc clean. On mespapiers.local: 401 without a cookie, 405 on GET, 200 with a ticket that verifies once and is `null` on replay.
> - **Step 7, resolved by PR #31 (2026-10-14):** Alexandre calls `verifyTicket()` in `verifyClient`, and `main.ts` loads `.env` and exits without `WS_TICKET_SECRET`. Still his when he adds them: forward `WS_TICKET_SECRET` to a `realtime` compose service, and an nginx `/ws` block.

**Design:** an HMAC-signed `userId.expiry.nonce` string. No Redis, no table, no `jose`. The `realtime` process verifies the HMAC and keeps used nonces in a `Set` — single-use, and a restart only invalidates tickets younger than 60 seconds.

- [x] **Step 1: Write the failing test** — `src/lib/auth/ticket.test.ts`

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

- [x] **Step 2: Run and watch it fail** — `npm test -- ticket`. Expected: FAIL, module not found.

- [x] **Step 3: Implement** — `src/lib/auth/ticket.ts`

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

- [x] **Step 4: Run and watch it pass** — `npm test -- ticket`. Expected: 5 passed.

- [x] **Step 5: Add the route** — `src/app/api/auth/ws-ticket/route.ts`

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

- [x] **Step 6: Enable `WS_TICKET_SECRET` in `.env.example` and `.env`**

`.env.example` already has `# WS_TICKET_SECRET=change_me_locally` under "Auth / sessions". Uncomment it there, and add a real value to your `.env` (`openssl rand -base64 32`). §0: uncomment a key in the same PR that introduces its service. For the tests, put `process.env.WS_TICKET_SECRET ??= "test-only";` at the top of `ticket.test.ts`, so they do not depend on anyone's `.env`.

**Compose does not forward `.env` to `web`.** It sets only `DATABASE_URL` in `environment:`, and the image picks up `.env` only through `COPY . .` at build time. Add `WS_TICKET_SECRET: ${WS_TICKET_SECRET}` to the `web` service's `environment:` in `docker-compose.yml` (Adrien's file), and to `realtime` when it exists. Phases 8 and 9 need the same for the OAuth keys.

- [x] **Step 7: Commit and tell Alexandre**

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
> - C5 run (2026-10-03, Chromium on mespapiers.local): a foreign document read gets 404; a foreign `deleteDocument` gets a **500** (it throws a plain `Error`; Amir's file) and deletes nothing. Amir's PR #28 (merged 2026-10-12) replaced the throw with an owner-scoped `deleteMany` and a redirect to the dashboard; rerun B10 to confirm.
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

## Phase 4 — Admin surface (C14, first half) ✅ — module 1's auth half (its profile half is phase 12, §C-22)

> **Done.** PR #24, `e20f85e` (2026-10-07): `58508e1` 4.1 + 4.2, `c920519` 4.3, `b9b09d4` final-review fixes, `d1eb993` merge of `main`. Follow-ups: PR #26 (`f4b9b10`, nav) and PR #27 (`bd4ba78`, responsive layout). **As shipped**, where the code differs from the steps below, each with its ruling in the SDD ledger:
> - **4.1:** all ten seeded users get the dev password `motdepasse123`, not only two; `rasiol@gmail.com` is the ADMIN. Step 1 (manual) was skipped.
> - **4.2:** the 403 card is `mx-auto mt-12 max-w-xl`, like the document error pages. The nav switches to ☰ below **1024 px (`lg`)**, not 768: at 768 the admin's nav wrapped to two rows (`Nav.tsx`, `MobileMenu.tsx`). *Reverted to `md` when `main` was merged (2026-10-07): PR #23 moved the account links into a `UserMenu` dropdown, and the admin link went in there.*
> - **4.3, security:** `page.tsx` checks `can(ctx, "user:manage")` itself and returns `null`. The layout's 403 card alone let the page run and ship every user's email in the RSC payload (shown with Playwright, then fixed; `CLAUDE.md` gotcha).
> - **4.3, actions:** the delete is audited **after** it succeeds. A double click, a stale page or another admin acting first (Prisma P2025) changes nothing and throws nothing; setting a role the user already has is a no-op; a `role` other than USER/ADMIN is refused (final review, 2026-10-07). `actions.test.ts` has 7 DB tests.
> - **4.3, UI:** the delete takes two steps (a native `<details>`: *Supprimer* → *Confirmer*), and the table hides columns below 640/768/1024 px instead of scrolling. PR #27: the role column shows from 480 px (below that, the badge sits in the user cell), the buttons shrink below `sm`, and the email wraps after the `@`, so the table no longer overflows at 320 px.
> - **Nav (PR #26):** the admin link lives in `UserMenu`'s dropdown and in the ☰ panel, which reuses the dropdown's rows (`AccountLinks`, exported from `UserMenu.tsx`). The ☰ panel now closes on an outside tap and on blur.
> - No separate `c14a` expansion doc: these steps were already detailed enough.

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

**This is where "different views/actions per role" becomes demonstrable for global roles.** The channel-scoped half arrives in phases 5–6 (phase 7 was cut, §C-21).

### Task 4.1: An admin you can log in as

- [x] **Step 1: Now, for development.** Sign up two accounts at `/fr/signup`, then set `globalRole = ADMIN` on one of them in `npm run db:studio`. This needs no code. It is enough to build and verify the whole phase.

- [x] **Step 2: Seed them.** Amir's rewrite of `prisma/seed.ts` is merged (PR #9: ten users named `` `${name}@gmail.com` ``). Give one seeded user `globalRole: "ADMIN"` and both a `passwordHash` from `hashPassword()` (import it relatively, `../src/lib/auth/password`, as the seed already does for the Prisma client). **Lowercase the seeded emails.** The login schema lowercases its input, so `Amir@gmail.com` can never match. That is also why today's seeded users cannot log in. Write the dev password in `docs/testing-auth.md`. Then:

```bash
npm run db:reset   # resets AND seeds (prisma.config.ts registers the seed); do not run db:seed after it
```

### Task 4.2: The 403 layout

- [x] **Step 1: Add the strings.** In `messages/fr.json` add an `admin` namespace with `forbiddenTitle` and `forbiddenBody`. The page's strings come in task 4.3: title, search label, column headers, role names, promote/demote/delete labels, and the empty state. Then add the same keys to `en.json` and `es.json`. `t()` is typed against `fr.json`, so a key missing there fails the typecheck.

- [x] **Step 2: Write it** — `src/app/[locale]/(app)/admin/layout.tsx`

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

- [x] **Step 3: The admin link in the nav** — `src/components/Nav.tsx` ⚠ Alexandre's file

Inside the signed-in branch, render `<Link href="/admin/users">` only when `can(ctx, "user:manage", {})`, with a new `nav.admin` key. This is the smallest visible "different view per role", and evaluators look for it. Check the nav at 375 px: the new link adds one more item to the open 375-px overflow issue (worklog). Fix it in this phase (revised 2026-10-06), for example by putting the link in `MobileMenu` below the breakpoint, and tell Alexandre what changed.

- [x] **Step 4: Verify both roles by hand**

Log in as the plain `USER` and open `/fr/admin/users`, then `/en/…` and `/es/…`: the translated 403 card renders, the page is not blank, and the URL does not change. Log in as the `ADMIN`: the page renders, and the nav shows the link.

### Task 4.3: The user list and role actions

- [x] **Step 1: Write the actions** — `src/app/[locale]/(app)/admin/users/actions.ts`

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

- [x] **Step 2: Write the page** — `src/app/[locale]/(app)/admin/users/page.tsx`

A server component with `export const dynamic = "force-dynamic"`. Query with `prisma.user.findMany({ select: { id, email, displayName, globalRole, reputation, createdAt, _count: { select: { documents: true, sessions: true } } }, orderBy: { createdAt: "desc" } })` and render it with `Table`/`TableHead`/`TableBody`/`TableRow`/`TableHeaderCell`/`TableCell` from `src/components/ui/Table.tsx`, with a `Badge` for the role. Every label comes from `getTranslations("admin")`, and dates are formatted with next-intl's `format.dateTime` (time zone `Europe/Paris` is already configured). `searchParams` is a Promise in Next 16: `const { q } = await searchParams`. Each row carries two `<form action={…}>` buttons — promote/demote and delete — bound with `.bind(null, user.id)`. Render no buttons on your own row, since both actions throw for it. Add a `?q=` search filter on email and display name using `contains` with `mode: "insensitive"`.

- [x] **Step 3: Verify the whole surface**

As the admin: search, promote the plain user to ADMIN, demote them back, then delete a throwaway user. Confirm in `npm run db:studio` that `AuditLog` has one row per action with the right `actorUserId`, `targetId` and `metadata`. Confirm the promoted user's `Session` rows disappeared. Confirm no buttons render on your own row. Confirm the Chrome console is clean. Resize to 375, 768 and 1440 px and check there is no horizontal scroll, that the table stays readable and that the buttons can be reached with Tab. Fix any design or responsive problem before committing.

- [x] **Step 4: Commit**

```bash
git add "src/app/[locale]/(app)/admin" messages src/components/Nav.tsx prisma/seed.ts docs/testing-auth.md
git commit -m "feat(admin): add the user list with role management and audit writes"
```

- [x] **Step 5: Open the PR**

Title: `feat(admin): user management and role administration`. In the description, state the two §C decisions this phase depends on (rendered 403; no global MODERATOR), tag Alexandre to review the `Nav.tsx` link and the 375-px fix, and Amir to review `prisma/seed.ts` (task 4.1 step 2 goes in this PR, since `feat/channels` is merged). Alexandre's `friends` branch also appends a namespace to `messages/*.json`, so whichever merges second resolves a small conflict at the end of those files.

---

## Phases 5–12 — specifications

Per `CLAUDE.md`'s rule: **phases 0–4 carry full TDD steps; phases 5–12 are specified at task level and each is expanded into its own `docs/plans/YYYY-MM-DD-<id>.md` when its gate opens.** Phases 5–7 were rewritten on 2026-10-02. E9–E11 are Amir's (§B), so they now cover only what is yours: putting the policy into his community actions and channel-role management (C14b). Phase 7, the module 2 sign-off, was cut on 2026-10-19 (§C-21). Phase 12 (module 1's profile side, §C-22) was added on 2026-10-19 and comes after phase 11 in this file but **before phase 8 in time**.

### Phase 5 — The policy in the channel actions (C5, C6 in Amir's merged code) · 1d ✅

**Expanded into:** [`2026-10-14-c5-c6-channel-policy.md`](2026-10-14-c5-c6-channel-policy.md) (2026-10-14), on `feat/channel-policy`. **Rasiol's decisions (2026-10-14):** the page checks are part of this phase (each page that holds a form asks `can()` the same question as its action, so admins can reach what the actions now allow and no page offers an action that throws); Amir is asked about the behaviour changes after the PR is open; every audit row, `deleteChannel`'s included, is written after the mutation and only when it happened; after task 1, *keep only what is necessary*: the three self-service rows below are dropped (their `assertCan` always passes for a signed-in user), and so are two test assertions; the final whole-branch review is kept. The expansion's *Departures* table lists where it differs from this section.
**Entry gate:** phase 3 merged **and** `feat/channels` merged: **both met on 2026-10-05** (PRs #18 and #9). Phase 4 has merged too (PR #24). His PR merged with every check still inline; phase 5 converts them (see *As built* below). **Amir's PR #28** (merged 2026-10-12, `e0e00df`) deleted `kickMember` and the `deleteChannel` copy in `create/action.ts`, and rewrote `kickMembers`; cut `feat/channel-policy` from `main` after it.
**Schema:** none. **Files:** Amir's, under `src/app/[locale]/(app)/channels/`. If you write the change, open `feat/channel-policy` and tag him.

**The mapping.** Validation failures (bad id, empty text) can keep their silent `return`. Authorization becomes `assertCan`, called after loading the row it needs.

| Action (file) | Today's check | `assertCan(ctx, …)` | `writeAudit` |
|---|---|---|---|
| `createChannel` (`create/action.ts`) | session only | ~~`"channel:create", {}`~~ **dropped 2026-10-14**: always passes for a signed-in user | — |
| `editChannel` (`[id]/edit/action.ts`) | `createdBy === user.id` | `"channel:update", { channelId }`. Moderators may edit too, a behaviour change to agree with Amir | yes |
| `deleteChannel` (`[id]/delete/action.ts`; PR #28 removed the duplicate in `create/action.ts`) | MODERATOR membership | `"channel:delete", { channelId, ownerUserId: channel.createdBy }`: creator or admin (phase 3 test) | yes, **after** the delete, only when it removed the row (decided 2026-10-14: `AuditLog.channelId` has no foreign key, so the row outlives the channel) |
| `joinChannel` (`join/actions.ts`) | `!isPrivate` | ~~`"channel:join", { channelId }`~~ **dropped 2026-10-14**: always passes; the `isPrivate` check stays | — |
| `requestJoinChannel` (`join/actions.ts`, default export) | session user, not already a member | ~~`"channel:join", { channelId }`~~ **dropped 2026-10-14**: always passes | — |
| `acceptJoinRequest` / `rejectJoinRequest` (`[id]/requests/action.ts`) | MODERATOR membership | `"channel:moderate", { channelId }` (§C-16) | yes |
| `inviteUser` (`[id]/invite/action.ts`) | MODERATOR membership | `"channel:moderate", { channelId }` | yes |
| `kickMembers` (`[id]/kick/action.ts`; PR #28 removed the duplicate `kickMember` in `[id]/actions.ts`) | MODERATOR membership; since PR #28 it also refuses kicking yourself or a MODERATOR | `"channel:moderate", { channelId }`; keep both refusals | yes |
| `acceptInvite` / `declineInvite` (`invitations/action.ts`) | the invite row for `user.id` | none: the caller's own invite row is the authorization | — |
| `leaveChannel` (`[id]/actions.ts`) | own membership | none: the caller's own row | — |
| `createAnswer` (`[id]/actions.ts`) | membership in the query | `"answer:create", { channelId: thread.channelId }` | — |
| `modifAnswerUser` (`[id]/actions.ts`) | author | `"answer:update", { ownerUserId: answer.userId }` | when actor ≠ author, i.e. an admin (added by the final review, 2026-10-14) |
| `deleteAnswer` (`[id]/actions.ts`) | author only, in the query | `"answer:delete", { channelId, ownerUserId: answer.userId }`: the author, **or a moderator of that channel** (§5) | when actor ≠ author |

| Task | Deliverable | Done when |
|---|---|---|
| 5.1 | Every row of the table applied | no action under `channels/` authorizes with `role === "MODERATOR"`, `role: "MODERATOR"` in a `where`, or `createdBy !==` (role reads for *display* are fine) |
| 5.2 | Audit writes | every "yes" row writes one `AuditLog` row with `channelId` and the target |
| 5.3 | Cross-channel check by hand | a moderator of channel A who replays a kick form with channel B's id is refused; a plain member's kick in A is refused; an admin kicks a member in a channel that has **no moderator** (§C-19: delete its only moderator in the admin surface first) and succeeds; recorded in `docs/testing-auth.md` |

**As built (2026-10-14, `feat/channel-policy`; merged in PR #33 on 2026-10-16, `8bf5fcd`):** Tasks 1–3 of the expansion, committed by Rasiol as `07dc37b` (kick, join requests, invite), `34275cd` (edit, delete) and `cbe363d` (answers); the create/join rows are dropped (decision 4). **5.1:** the grep finds 4 lines, none of them an authorization check: `leaveChannel`'s moderator-cannot-leave rule, `createChannel`'s `MODERATOR` write, and the `/channels` options menu twice (display, moved to 6.2). **5.2:** each "yes" row writes its `AuditLog` row after the change, only when it happened; pinned by `channels/channel-policy.test.ts` (9 DB tests, each watched failing first). **5.3:** B12 in `docs/testing-auth.md`. The page checks were verified server-side on mespapiers.local with throwaway sessions (deleted after): lina gets 404 on the five management pages of *Assurance auto*; rasiol (admin, not a member) gets 200 on them and 404 on the channel page; amir sees 2 answer *delete* buttons and no *edit* link on others' answers, and 3 *Kick* buttons. The forged kick, the console and the 375/768/1440 check are Rasiol's browser run of B12. **Final review (2026-10-14, fresh Opus reviewer):** "with fixes", 0 Critical, 2 Important, both fixed with a failing test first: a non-member admin is sent to `/channels` after `editChannel` / `modifAnswerUser` (the channel page 404s for them; the requests page's back link too), and an admin's rewrite of someone else's answer writes `answer:update`. The 5 Minor findings are deferred (worklog). **Gates:** `npm test` 208/208 (17 files, after the fixes), build, typecheck, lint 0/0, `i18n:check` unchanged (the 5 known unused keys). **Departures:** the expansion's *Departures* table and decision 4.

**Review notes for Amir's code** (PR #9 merged; status checked 2026-10-12, after PR #28 merged). Send them with the table:
- ✅ **Fixed before merge:** `requestJoinChannel` now takes `user.id` from `requireUser()`, parses the channel id from `channelId` and awaits the `create`.
- `revalidatePath("/channels")` and `` revalidatePath(`/channels/${id}`) `` match nothing under `[locale]`. Use the file pattern: `revalidatePath("/[locale]/(app)/channels/[id]", "page")`. His bare `redirect` hrefs are fine, because `@/i18n/navigation` localises them. **Still open:** most calls are bare paths; PR #28 converts only `kickMembers`.
- **Fixed in PR #28 (merged 2026-10-12):** `updatedAt` on `ChannelInvite` and `ChannelJoinRequest` (migration `20261009120554_add_updated_at_to_channel_invite_and_join_request`); one `kick` and one `deleteChannel` action; lint at 0 errors and 0 warnings (the requests page is translated, `next/image` on `/channels`); `deleteDocument` no longer throws a 500 on a foreign id (phase 3's C5 run). **Fixed earlier:** the `npm init` junk is gone from `package.json`, and the seeded users can log in (task 4.1, PR #24).
- **PR #28 review (2026-10-12):** on the branch, lint 0/0, `tsc` clean, `i18n:check` only the 5 known unused keys, all 8 migrations apply to an empty DB with no drift from `schema.prisma`, `npm test` 180/180 (scratch DB). **Merged without it, fixed by Rasiol on `fix/nav-channels`:** the new *Channels* nav link is only in the bar (`barLinks`), not in the ☰ panel (`panelLinks`), so below 768 px nothing in the nav reaches `/channels`. Moving it into `AccountLinks` in `UserMenu.tsx` puts it in both, signed-in only, which also drops the signed-out link that only bounces to `/login` and the mis-indented `<>`. **Follow-ups, still open:** `deleteDocument`'s `Number()` check lets `id=99999999999` through and Prisma throws (INT4 overflow, a 500 that deletes nothing, same as before); the stray `{" "}` after the date on the requests page. (Done at merge: squashed into one conventional commit; `CLAUDE.md` updated for eight migrations and the `updatedAt` columns.) **Already on `main`, not caused by PR #28:** `requests/action.ts` revalidates `/[locale]/channels/[id]/requests` without the `(app)` group; the kick page shows *Kick* next to moderators and the viewer, where the action silently refuses; it also prints the raw role enum (`MEMBER`) untranslated. PR #28 also edited `CLAUDE.md` and `handoff/WORKLOG.md`; the conflict with the uncommitted docs sync was resolved on `fix/nav-channels`.
- `joinChannel` already uses `createMany({ skipDuplicates: true })`, so E9's "idempotent under a double-click, via the constraint" holds. Keep it that way.

### Phase 6 — Channel role management (C14, second half) · 0.5d ✅ — **Module 2 complete**

**Expanded into:** [`2026-10-18-c14b-channel-roles.md`](2026-10-18-c14b-channel-roles.md) (2026-10-18). Its *Keep vs. Cut* table lists what this section dropped on 2026-10-18 and why. In short: the last-moderator guard (§C-20); 6.3's forged form in channel B, already pinned by phase 5's test *replays a kick with another channel's id*; and 6.4, the Helper badge, moved to phase 7 as task 7.5 (since cut, §C-21), because nothing writes `User.reputation` until Amir's E10 and the badge is D14's to render.
**Entry gate:** phase 5 merged: **met on 2026-10-16** (PR #33). Phase 6 no longer waits on E10.
**Schema:** none. **Files:** Amir's, under `src/app/[locale]/(app)/channels/`. Open `feat/channel-roles` and tag him.

| Task | Deliverable | Done when |
|---|---|---|
| 6.1 | `setChannelRole(formData)` in `[id]/kick/action.ts`, next to `kickMembers` | `assertCan(ctx, "channel:manageRoles", { channelId })`: admins only, in any channel (§C-18). Changes an **existing** membership only (`updateMany`, no upsert), and only when the role differs, so a double click writes nothing. Demoting the last moderator is allowed (§C-20). Writes `channel:setRole` (`metadata: { role }`) when a row changed. **Invalidates no sessions:** `validateSessionToken()` re-reads memberships on every request, so the change applies on the target's next request |
| 6.2 | Promote/demote buttons, and the `/channels` menu | on Amir's member list (`/channels/[id]/kick`), one button per row inside the existing kick form (`formAction={setChannelRole}`, the new role in a hidden `role` input, not the button's `name`: React overrides it), shown only when `can(ctx, "channel:manageRoles", { channelId })`; the row's role is translated. Strings go in his `channels` namespace. **Also (deferred from phase 5):** each link of the `/channels` options menu (`channels/page.tsx`) asks the `can()` its page asks (`channel:update`, `channel:delete`, `channel:moderate`) instead of `members[0]?.role === "MODERATOR"`. A promoted moderator is not the creator, so *Delete* is not theirs. One menu replaces the two copied ones |
| 6.3 | **C14 Done-when, scoped** | a DB test: an admin promotes a member of channel A, and that member's existing session kicks in A on its next request. The "refused in B" half is phase 5's test. By hand (B13): the admin joins A, promotes, the new moderator kicks. Hide/mute are E11's, Amir's (phase 7 cut, §C-21) |

**As built (2026-10-18, `feat/channel-roles`; merged in PR #34 on 2026-10-19, `70ba217`):** Tasks 1–3 of the expansion, committed by Rasiol as `5989fbd` (`setChannelRole`, 3 DB tests, each watched failing first, plus a mutation check on its `assertCan`), `4155e50` (the kick page buttons, translated roles) and `27da8a4` (the `/channels` menu on `can()`, 343 → 289 lines). **B13 in real Chromium** (Playwright, on mespapiers.local) found one bug the DB tests cannot reach: React replaces the `name` of a button whose `formAction` is a server action with `$ACTION_ID_…`, so `role` never reached `setChannelRole` and a click changed nothing. Fixed by sending the role in a hidden input; B13 then passed every row, with no console error or warning and no sideways scroll at 375 / 768 / 1440, and the audit query returned the 4 expected rows. **Gates:** before the hidden-input fix, `npm test` 211/211 (17 files; auth part 9 files, 93 tests), build, typecheck, lint 0/0, `i18n:check` unchanged (the 5 known unused keys). On the final tree (`357a804`, after both review fixes): `npm test` 212/212 (auth part 94), typecheck, lint 0/0, `i18n:check` unchanged, and `npm run build` exit 0 (its log has the known Prisma engine-not-found noise from building with the container's engine). **Departures:** the expansion's rulings (the `i18n:check`-visible `t()` calls, the hidden `role` input, a 12-hit role grep). **Final review (2026-10-18, fresh Opus reviewer):** "with fixes", 0 Critical, 2 Important. Fixed with a failing check first: the member list re-sorted after each role change (no `orderBy`), so a second click could promote the next member; it is now ordered by `joinedAt`, then `userId`, and after the fix `npm test` 211/211, lint 0/0, typecheck clean, B13 passed again. Also changed (Rasiol): an admin-appointed moderator could not leave (`leaveChannel` refused every moderator); it no longer refuses them (§C-20), pinned by a DB test (`npm test` 212/212), with *Leave* shown to every member and B13 passed again. Amir is told in the PR. **Amir's review (2026-10-19):** a creator who left, or was demoted, could still delete the channel by URL. `can()` now requires the creator to still moderate it (§C-20), with the policy test, the truth-table row and two DB tests watched failing first; `npm test` 213/213, typecheck, lint 0/0.

### Phase 7 — Moderation sign-off — ✂ **cut on 2026-10-19** (§C-21)

Nothing to build and no expansion doc. Module 2 closes with phase 6 (§C-21). What each task became:

| Task | Verdict | Why |
|---|---|---|
| Entry gate (E11, E10, D14) | cut | It made module 2 wait on three teammate deliverables, none of them started (checked 2026-10-19 on `main` and every remote branch) |
| 7.1 Review E11 for the policy | cut as a task, kept as a review note (below) | ordinary review of Amir's PR. The policy side exists: `channel:moderate`, scoped to one channel, in the truth table |
| 7.2 Mute enforcement | cut, kept as a review note (below) | it exists only if Amir ships mute |
| 7.3 The promoted moderator hides and mutes in A only | cut | E11's own Done-when. The channel boundary is already proven with kick: phase 5's cross-channel replay test, B12 row 3, B13 row 6 |
| 7.4 Evaluation demo script | cut | B11, then B13 (member, admin, appointed moderator and creator on one channel), then B12 row 3 |
| 7.5 Helper badge check | cut, kept as a review note (below) | the permission half is phase 3's test; showing the badge was D14's (module 1), left out of phase 12 until E10 (§C-22) |

**Review notes for Amir's E10 and E11 PRs, and for whoever renders the Helper badge** (no task; read them when the PR comes):
- **E11, hide and unhide:** `assertCan(ctx, "channel:moderate", { channelId })` and one `AuditLog` row with `channelId` and the target (C6). For members, hidden content is left out **in the query**, not hidden with a CSS class over data already sent: the RSC payload would still carry it (task 4.3's lesson).
- **E11, mute:** a muted member's `thread:create` / `answer:create` is refused **server-side**. The simplest place is `can()`: add `mutedUntil` to the memberships `select` in `validateSessionToken()` and deny `MEMBER_ACTIONS` while it is in the future. That is two lines in Rasiol's files, written in Amir's PR.
- **E10:** the vote and the reputation change go in **one** `$transaction`, and a second vote `upsert`s on `@@id([answerId, userId])`. Amir's `correction` branch adds `CHECK (value IN (-1, 1))` on `Vote.value`, so a crafted `9999` is refused by the database; check the value in the action too, or the refusal is a 500.
- **Helper badge** (D14, or Amir's answer list, whichever renders it first): compute `reputation >= threshold` **at render**. No column, no threshold job, never in `policy.ts`.

### Phase 8 — OAuth 2.0 Google (C7) · ≈ 1d (1.5d before its Keep vs. Cut)

**Expanded into:** [`2026-10-26-c7-oauth-google.md`](2026-10-26-c7-oauth-google.md) (2026-10-26, after a Keep vs. Cut with Rasiol; Tasks 0–6, `npm test` 262 → 273, browser check B15). Its *Design decisions* settle what this section left open: the redirect host, the OAuth-only deletion, unverified emails, the display name, userinfo instead of the ID token, the button primitive, one cookie.
**Entry gate:** phase 4 green: **met on 2026-10-07** (PR #24). Only phase 2 is a technical dependency, and it is merged. Phase 12 went first and merged on 2026-10-23 (PR #38), so this is the next phase.
**Schema:** no migration. `OAuthAccount` exists with `@@unique([provider, providerUserId])`.
**Env:** uncomment `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.example` in this PR, and forward them and `APP_URL` in the `web` service's `environment:` in `docker-compose.yml` (compose does not pass `.env` through; see task 2.5 step 6). No code read `APP_URL` before this phase.
**Routes:** `src/app/api/auth/…` is not localised (the middleware matcher skips `/api`). The callback creates the session with `createSession()` + `setSessionCookie()`, which works in a Route Handler, and then redirects to `/`. The middleware adds the locale prefix. Failures redirect to `/login?error=oauth`, and the page shows an `auth.errors` key, never the provider's raw message.
**Redirect URI:** build it from `APP_URL`. It must match the Google console entry byte for byte, and browsers only ever reach the app through nginx. **Corrected 2026-10-26:** Google refuses `https://mespapiers.local/api/auth/google/callback` (a redirect host's TLD must be on the public suffix list; `localhost` is the one exception), so it is `https://localhost/api/auth/google/callback`, and Google sign-in is tested on `https://localhost` (nginx already serves that name). Expansion, decision 1.

| Task | Deliverable | Done when |
|---|---|---|
| 8.1 | `src/lib/auth/oauth/pkce.ts` — `createVerifier()`, `challengeFor(verifier)`, `createState()` | S256 challenge is `base64url(sha256(verifier))`, verified against a hand-computed fixture; all three use `node:crypto`, no dependency |
| 8.2 | `GET /api/auth/google/start` | sets `state` and `code_verifier` in **httpOnly, 10-minute, `sameSite: lax`** cookies and redirects to Google's authorization endpoint with `code_challenge_method=S256` |
| 8.3 | `GET /api/auth/google/callback` | a mismatched `state` is rejected; a **replayed** callback is rejected because the callback deletes both cookies before doing anything else; the token exchange sends the `code_verifier` |
| 8.4 | Account resolution | existing `OAuthAccount` → sign in; no account but the email matches a `User` → **link** to that user; neither → create the user with `passwordHash: null` |
| 8.5 | Login page button | "Continue with Google" appears on `/[locale]/login` and `/[locale]/signup`, with its label as a message key in all three locales. It is a plain link to `/api/auth/google/start`, not a form |

**Watch for:** `sameSite: "lax"` on the state cookie, not `strict` — Google's redirect is a cross-site navigation and `strict` drops the cookie, giving a state mismatch on every attempt.

**Watch for (2026-10-12; PR #30 merged with it on 2026-10-20):** 8.4 creates users with `passwordHash: null`. Amir's `deleteAccount` confirms with the password and answers `wrongPassword` when there is none, so an OAuth-only user can never delete their account (E13). Agree with Amir what they confirm with instead, and land it no later than phase 8's PR; phase 11's fresh-TOTP check only helps users who enabled 2FA. **Settled 2026-10-26 (Rasiol):** they type their email; the expansion's Task 4, in Amir's files with his review.

**Keep vs. Cut (2026-10-26):** kept 8.1–8.5, plus refusing an email Google has not verified (the same takeover phase 9 guards against), the OAuth-only deletion, and a `GoogleButton` primitive with Google's logo and a gallery entry. Cut: the `oauth/` directory and `providers.ts` (one file, `src/lib/auth/oauth.ts`, until GitHub comes), `createState()`, the ID token, `nonce`, stored tokens, new infra for the redirect host, validating Google's name, audit rows or mails on link, a rate limit on these routes, return-to-page, unlink and connected accounts. The table with the reasons is in the expansion.

**As built (2026-10-26, `feat/oauth-google` from `d47f258`; not pushed, PR to come):** the expansion's Tasks 0–4, executed inline task by task, each committed by Rasiol: `5681640` (the plan and the docs sync), `b9553bb` (Task 1: `randomToken()`, `challengeFor()`, `googleProfileSchema`, `resolveGoogleUser()`, `emailField` exported; 5 tests), `7ef8161` (Task 2: the start and callback routes, 2 + 3 tests; `.env.example` and compose gain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_URL`), `f6c8d86` (Task 3: `GoogleButton` with Google's "G" and its gallery entry, on the login and signup pages; the login page shows `auth.errors.oauthFailed` for `?error=oauth`), `55a4abe` (Task 4, Amir's files: an account with no password confirms its deletion with its email; 1 test). Every test watched failing first; mutations caught by the tests: the `email_verified` refusal, base64url → base64, the state check, the cookie clearing, the email comparison in `deleteAccount`. **Gates** (Task 5): `npm test` 273/273 (27 files; auth + profile 16 files / 126 tests), lint 0/0, `i18n:check` the 5 known keys, build exit 0 (only the known middleware → proxy warning), typecheck. **B15** (`docs/testing-auth.md`), on `https://localhost` with a real Google account (rows 2–8 by Rasiol, read back from the server log, the audit rows and Mailpit; rows 1, 9, 10 and 11 by Claude in headless Chromium): **all 11 rows passed**. Row 7 needs the app's access revoked first (myaccount.google.com/connections): Google shows *Cancel* only on its consent screen, which it skips once the user has consented. **Departures from the table above:** 8.1 is `randomToken()` + `challengeFor()` in `src/lib/auth/oauth.ts`, not `oauth/pkce.ts` with `createVerifier()` / `createState()`; 8.2–8.3 use **one** cookie, `mp_oauth` = `<state>.<verifier>` on `Path=/api/auth/google` (decision 7); 8.3's "deletes both cookies before doing anything else" became "every answer clears the cookie", which the browser applies when the answer arrives, so two copies of the same callback sent at the same moment both pass the state check; Google's authorization code is single-use, so the second exchange fails and ends on the login page; 8.4 reads Google's userinfo endpoint, not the ID token (decision 5), and refuses an unverified email (decision 3); 8.5's link is a `GoogleButton` primitive (decision 6). **Rulings** (ledger `.superpowers/sdd/2026-10-26-c7-oauth-google/progress.md`): Task 1, the plan's RFC 7636 fixture challenge was wrong (written from memory) and was corrected to the RFC's `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM` (the code was right); Task 4, the RED run failed with a Zod field error, not the plan's `wrongPassword` (today's action parsed the password first), the same cause. **Found on the way, not phase 8's:** the `web` image carries a 2026-10-05 copy of `.env` (`.dockerignore` has no `.env` rule; `CLAUDE.md`, *Gotchas*); the ColorZilla browser extension adds `cz-shortcut-listen` to `<body>`, so a browser with it logs a hydration mismatch on every page (graded console checks: use a window without extensions). **Final review (2026-10-26, fresh Opus reviewer):** with fixes, 0 Critical, 1 Important, 5 Minor; it agreed with both rulings and with the cookie departure (a deletion only lands with the response; Google's single-use code stops a concurrent duplicate). **Important:** signup never verifies emails, so whoever signed up first with an address kept its password and session after the owner's Google sign-in linked into the account (proved by a probe). Rasiol's call: **the link drops the password and ends the account's sessions**, in one transaction with the new `OAuthAccount` (a real user who had a password becomes Google-only and deletes by email; expansion decision 10). **Graded up from Minor:** `.slice(0, 50)` could split an emoji, which Postgres refuses, so that person's Google sign-in failed every time; the cut now counts characters. **Folded in (Rasiol):** an HTML error page from Google pinned by a test; Google's refusal reason (`invalid_grant`, …) in the log. Each fix watched failing first, with mutation checks; `npm test` 276/276 (auth + profile 16 / 129), lint 0/0, typecheck, `i18n:check` unchanged. **Deferred:** the `?error=oauth` message stays next to a later password attempt's field errors. B15 row 5's expectation changed (the password is dropped): rerun it. **Next:** the PR.

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

**Watch for (phase 8's final review):** the reverse takeover. Signup never verifies emails, so linking to an existing account by email must drop its password and end its sessions, as `resolveGoogleUser()` does (expansion decision 10). 9.1's shared helper keeps that, and 9.4's "password account → then GitHub" ends with a Google- or GitHub-only account.

### Phase 10 — TOTP 2FA (C9) · 1.5d

**Expand into:** `docs/plans/<date>-c9-totp-2fa.md`
**Entry gate:** phase 9 exit gate green (order only; TOTP depends on nothing in OAuth, so swap 8–9 and 10–11 if that suits the week).
**Schema:** ⚠ **one of the plan's two migrations** (the other is phase 12's). Add `User.recoveryCodes String[]` (SHA-256 digests, not the codes) and `Session.twoFactorVerifiedAt DateTime?`. `User.totpSecret`, `User.totpEnabled` and `Session.twoFactorVerified` already exist. `prisma/` is Amir's directory and his branches carry migrations of their own, so rebase onto `main` and run `npm run db:migrate` on the day you create it; two migrations created in parallel get the order wrong. Amir reviews.
**Deps:** `npm install otpauth@^9.5.2 qrcode@^1.5.4` + `npm install -D @types/qrcode`.

| Task | Deliverable | Done when |
|---|---|---|
| 10.1 | Migration `add_2fa_fields` | applies cleanly; a fresh `db:reset` replays it |
| 10.2 | `src/lib/auth/totp.ts` — `createSecret`, `otpauthUri`, `verifyCode`, `generateRecoveryCodes`, `consumeRecoveryCode` | `verifyCode` accepts a code from the **previous, current and next** 30-second window (`window: 1`) and rejects one two windows out — tested with `vi.setSystemTime`, no live clock |
| 10.3 | Enrollment at `/[locale]/account/security`, next to Amir's `/account/data` (phase 12's expansion, decision 4) | the QR **scans in a real authenticator app**; `totpEnabled` only flips to `true` after the user submits a valid code, so nobody can lock themselves out by navigating away mid-enrollment |
| 10.4 | Recovery codes | exactly 10 are shown **once**, stored only as digests, and each works **exactly once** — the consuming update removes it from the array in the same query |
| 10.5 | Login second step | when `totpEnabled`, login creates the session but leaves `twoFactorVerified: false` and redirects to `/[locale]/login/2fa`. A session that is `totpEnabled && !twoFactorVerified` counts as **signed out everywhere except that page**. Enforce this in `session.ts` (`getCurrentUser()`/`requireUser()`), the one place every caller goes through, and **not** in the `(app)` layout, which is not the boundary (§C-4). Otherwise the nav would greet a half-signed-in user. The 2FA page reads the pending session through its own small helper |
| 10.6 | Disable 2FA | requires a current code, clears `totpSecret`, `totpEnabled` and `recoveryCodes`, and writes an `AuditLog` row |

**Watch for (phase 8's final review):** the Google callback calls `createSession()` + `setSessionCookie()` directly. With TOTP, an OAuth sign-in to a `totpEnabled` account must leave `twoFactorVerified: false` and go through `/login/2fa` like password login (10.5), or Google sign-in bypasses the second factor.

**Watch for:** a rate limit must cover the 2FA step, or the second factor becomes a 6-digit brute force. The move this note used to ask for is done: since PR #30 (2026-10-20), `src/lib/auth/rate-limit.ts` exports `createRateLimiter()` (6 failures per key per 15 minutes; `tooManyAttempts`, `recordFailure`, `clearAttempts` over its own Map), and login and `deleteAccount` each create one. Create a third in the 2FA action, keyed by user id, not email.

### Phase 11 — Step-up 2FA on destructive actions (C10) · 0.5d — **Module 4 complete**

**Expand into:** `docs/plans/<date>-c10-step-up-2fa.md`
**Entry gate:** phase 10 exit gate green. Channel delete is Amir's action (merged in PR #9), so apply it there with his review.
**Schema:** none. Phase 10's `twoFactorVerifiedAt` covers it; expose it as `ctx.session.twoFactorVerifiedAt` (additive to `SessionContext`).

| Task | Deliverable | Done when |
|---|---|---|
| 11.1 | `requireFreshTwoFactor(ctx)` in `src/lib/auth/totp.ts` | returns immediately when `!ctx.user.totpEnabled`; redirects to `/[locale]/verify-2fa?next=…` when `twoFactorVerifiedAt` is null or older than **15 minutes** |
| 11.2 | Apply it | `deleteUser` (phase 4) demands a fresh code; so does Amir's `deleteChannel`, done in his file with his review |
| 11.3 | Offer it to teammates | C10's Done-when names **document delete** (`deleteDocument` in `src/app/[locale]/action.ts`) and the **GDPR export** (E12, merged in PR #30: the Route Handler `POST /api/account/export`, reached by a plain `<form method="post">` on `/account/data`. Its `next` must be the page, `/account/data`: 11.4 hands `next` to the localised `redirect`, which would turn `/api/account/export` into `/fr/api/account/export`, a 404). Both are Amir's files, so tell him the helper exists, and pair on the first call so the redirect-and-return flow is right |
| 11.4 | Re-verification page | submitting a valid code sets `twoFactorVerifiedAt = now()` and returns to `next`; `next` must start with `/` and **not** `//` or `/\`, or it is an open redirect (`//evil.example` is protocol-relative). Pass it to `redirect` from `@/i18n/navigation` so the locale is kept |

### Phase 12 — Profile, avatar, friends' online status (D14, reassigned) · ≈ 2d ✅ — **Module 1 complete**

**Assigned:** 2026-10-19, to Rasiol (§C-22). Done before phase 8 (§A, *Module order*): it reopened a major. **Merged in PR #38 on 2026-10-23** (`d47f258`, by Amir).
**Expanded into:** [`2026-10-19-d14-profile.md`](2026-10-19-d14-profile.md) (design brainstormed and approved by Rasiol on 2026-10-19; its *Design decisions* table settles 12-A to 12-C below).
**Entry gate:** phase 4 merged: **met**. 12.1 and 12.2 need no migration and can start now. 12.3 and 12.4 need one; it goes after Amir's PR #35 (which replaces every migration with one `init`) if that has merged by then, otherwise on the current history (decision 11).
**Schema:** one migration in Amir's `prisma/` (`add_profile`: `UserAvatar`, `User.lastSeenAt`); he reviews it. **Files:** yours (§D), plus one line in Alexandre's `UserMenu.tsx` (`AccountLinks`, so the link is in the dropdown and the ☰ panel) and the online dot in his `friends/page.tsx`, with his review.

| Task | Deliverable | Done when |
|---|---|---|
| 12.1 | Profile page | shows the display name, the avatar (or the default), the member-since date in `Europe/Paris`, and the online state; another user's profile never shows their email; the page calls `requireUser()` itself (the layout is not the boundary); an unknown id is a 404; linked from `AccountLinks`; every string is a key in fr/en/es |
| 12.2 | Update the profile | a Server Action changes the caller's **own** `displayName`, `where: { id: ctx.user.id }`, so a forged id in the form changes nothing (no `assertCan`: the caller's own row is the authorization, like `leaveChannel`); one Zod module, `src/lib/users/schemas.ts`, imported by the form and the action, reusing signup's `displayName` rule from `src/lib/auth/schemas.ts`; errors are i18n keys; the nav shows the new name on the next request (no session to invalidate: `validateSessionToken()` re-reads the user) |
| 12.3 | Upload an avatar | jpeg, png or webp, decided by magic bytes, never by `file.type`; no SVG (it can carry script); a size cap (12-B); a second upload **replaces** the first (one row per user, an upsert), so nothing is orphaned; `GET /api/users/[id]/avatar` answers 401 without a session and 404 when the user has none, and sends the stored type with `X-Content-Type-Options: nosniff` and `Cache-Control: private`; a user without one gets a **default avatar** (their initials, in CSS, no file) |
| 12.4 | Friends' online status | `/friends` shows online or offline for each **accepted** friend, never for a pending request or a block; the profile page shows it too. How it is known: 12-A |
| 12.5 | Checks | DB tests: 12.2 (only the caller's row changes), 12.3 (a replace leaves one row; an SVG, or a text file renamed `.png`, is refused by its bytes; 401 and 404 on the route), 12.4 (the online threshold, with `vi.setSystemTime`). Each watched failing first. A browser pass at 375 / 768 / 1440 with a clean console, keyboard-only through the upload. A manual test section in `docs/testing-auth.md` |

**Decisions for the expansion** (settled 2026-10-19: 12-A *last seen*, live dot later with `lastSeenAt` kept as the initial state; 12-B a separate `UserAvatar` table; 12-C edit forms on your own `/users/[id]`, 2FA at `/account/security`; plus profiles open to any signed-in user except across a block, and a browser-side re-encode that strips GPS metadata. The text below is the reasoning as first written):
- **12-A, how "online" is known.** *Recommended: last seen.* A `User.lastSeenAt DateTime?`, written by `validateSessionToken()` at most once a minute (`updateMany` with `lastSeenAt < now − 60 s`, so most requests write nothing); "online" means seen in the last 5 minutes. It is your own file, one column, testable with a fake clock, and needs no teammate. Ceiling: it is not live. A friend who closes the tab shows online for up to 5 minutes, and the page shows the state when it loaded. That departs from D14's "live online state"; record it as a §C entry. *The alternative, live presence:* the plan's design (D3's registry in the realtime server, `presence.changed` in `events.ts`, D5's client hook) needs Alexandre's D3, a `realtime` service in compose and an nginx `/ws`. None of them exist, and PR #36 (topics, merged 2026-10-21) is only the step before. Upgrade path: once D3 ships, the friends page subscribes and updates the dot live, and `lastSeenAt` remains the state at load.
- **12-B, where the avatar bytes live.** The team keeps files in Postgres (`Document.fileData`; `MEETING_DISCUSSION.md`), and `src/lib/storage/` does not exist. *Recommended:* a separate table, one row per user (`userId` as the key, `data Bytes`, `mimeType`, the timestamps), **not** columns on `User`: `validateSessionToken()` loads the user with `include`, which reads every `User` column, so bytes on `User` would be read on every request. A cap of 2 MB is plenty for an avatar. `User.avatarKey` stays unused (plan §3 meant it for a MinIO key); dropping it is Amir's call. Tell Amir that his GDPR export (PR #30) should include the avatar.
- **12-C, the routes.** One account area for what is now all Rasiol's: the profile page, phase 10's TOTP enrollment, next to Amir's `/account/data` (PR #30). For example, `/[locale]/users/[id]` for every profile (yours with the edit forms), `/[locale]/account/security` for phase 10. Pick once, here.

**Reuse:** PR #35 adds `sniffMime()` (pdf, png, jpeg, **webp**) to Amir's upload action. It is private to a `"use server"` file, which may export only async functions. Phase 12 copies it verbatim to `src/lib/files/sniff.ts` (Keep vs. Cut review, 2026-10-19), so it does not wait on #35; Amir imports it from there and deletes his copy.

**Closed (2026-10-22, phase 12's final review, Rasiol's call: done in this PR, for Amir's review):** the export now writes the avatar as `files/avatar.<ext>`, with its type and dates in `data.json`, pinned by a test in `route.test.ts`. **Was open (2026-10-20): the avatar in the GDPR export.** PR #30's export (`src/app/api/account/export/route.ts`, Amir's) lists the user's relations in one `include`, and `UserAvatar` is not among them, so after phase 12 the export would miss personal data. Deletion is already covered (the table's foreign key cascades). Either Amir adds it, or phase 12 does it in his file with his review (the image as a file in the ZIP, its type and dates in `data.json`). Rasiol's call; the phase 12 plan's PR text asks Amir for now.

**Not in it:** the Helper badge (nothing writes `reputation` before E10; the phase 7 note applies to whoever renders it); changing the email or the password (not in the subject's lines; the email is the login, and changing it needs a confirmation flow); saving the locale to `User.locale` (D10, Alexandre's); avatars in other people's lists (their owners' call: §B).

**As built (2026-10-22, `feat/profile` from `5a6b3b5`; merged in PR #38 on 2026-10-23 with the review fixes as `449fd40`):** the expansion's Tasks 0–5, committed by Rasiol as `804ea37` (plan and docs sync), `18b5ef0` (12.1: the page, the `Avatar` primitive with initials, *Mon profil*, friends' names linked), `fdb0a8e` (12.2), `0ec2e82` (Task 2b, *Ajouter en ami* on a stranger's profile, added by Rasiol on 2026-10-22), `b662efc` (`20261022115507_add_profile`, on the current history: PR #35 was still open, decision 11), `8d397e7` (12.4) and `12a5728` (12.3). Each test was watched failing first; 20 new tests (`profile.test.ts` 6, `actions.test.ts` 4, `route.test.ts` 3, `sniff.test.ts` 6, one in `session.test.ts`). **B14** (`docs/testing-auth.md`) ran in headless Chromium on mespapiers.local with throwaway users: every row passed (55 checks), including a 2.13 MB JPEG stored sideways with EXIF orientation 6, which came out a 256 × 256 PNG of 2.4 KB, upright, and a renamed `.txt` refused with no request sent. It found one console warning, the profile avatar flagged by `next/image` as a lazy LCP image, fixed with `loading="eager"` in `Avatar`. **Gates (final tree):** `npm test` 260/260 (24 files; 78 need the DB), build exit 0, typecheck, lint 0/0, `i18n:check` unchanged (the 5 known unused keys). **Departures from the table above:** 12.1's online state shows only on an accepted friend's profile (on your own it would always say *online*); 12.3 sends `Cache-Control: private, no-store` (plan §2), not just `private`; 12.4's threshold test passes `now` to `isOnline()` instead of `vi.setSystemTime`; 12.5's browser pass found that `/friends` offers *Bloquer* only to friends, so B14 row 10 accepts the request first. **Found, not phase 12's:** under `next dev`, every `notFound()` page logs a React `Performance.measure … negative time stamp` page error and preload warnings (the channel and document pages too; `CLAUDE.md`, *What does not exist*). **Final review (2026-10-22, fresh Opus reviewer, read-only, `5a6b3b5..12a5728` plus the working tree):** "with fixes", 0 Critical, 1 Important, 7 Minor; it agreed with all eight ledger rulings. Fixed (Rasiol's choices), each with a failing check first: **Important**, the GDPR export missed the avatar (now `files/avatar.<ext>`, a test in Amir's `route.test.ts`) and the privacy policy did not mention the photo or the online status (two sentences in `privacy.dataCollected.account.body`, fr/en/es, Adrien's); **Minor**, *Ajouter en ami* on a user deleted meanwhile was a 500 (P2003; fixed at the root in Alexandre's `sendRequest`, which now returns `notFound`; a DB test in `actions.test.ts`), an emoji-first name showed half an emoji as its initial (`[...word][0]`), the name field kept the padding after a save, and the avatar form showed the browser's untranslated "no file" bubble and did not link its error to the input (`noValidate`, `aria-describedby`). Those three were checked in Chromium (9/9, console clean); B14 rerun 55/55. Deferred minors: `lastSeenAt` writes also bump `User.updatedAt`; only the *Amis* tab links names; the plan's *Data flow* says `revalidatePath` where the code uses `refresh()`. The overengineering pass (ponytail) found ≈ 8 optional lines (one `Avatar` size; one `PeopleList` prop), kept by Rasiol. **Gates after the fixes:** `npm test` 262/262 (80 need the DB; auth + profile 13 files / 116), build exit 0, typecheck, lint 0/0, `i18n:check` unchanged.

---

## Coverage check

Every "To Do" from the four modules (`PROJECT_PLAN.md` §6), mapped to the phase that delivers it. ✅ = merged.

| Module | To Do | Phase |
|---|---|---|
| 1 · Standard user management & auth | Email + password signup/login, hashed and salted | 0.4, 1, 2 ✅ |
| | Sessions, protected routes | 1, 2 ✅ |
| | User CRUD | 2 ✅ (create), 4 ✅ (read/update/delete) |
| | Users update their profile information | 12.2 ✅ (§C-22) |
| | Users upload an avatar, with a default when there is none | 12.3 ✅ |
| | Users add friends and see their online status | friends: Alexandre's PR #23 ✅ · online status: 12.4 ✅ |
| | A profile page showing the user's information | 12.1 ✅ (PR #38) |
| | ~~Helper badge, locale~~ (were in D14) | out of phase 12: the badge waits for E10 (phase 7 note), the locale is D10's |
| 2 · Advanced permissions | `can()` / `assertCan()` policy module | 3 ✅ |
| | Admin surface: user list, promote/demote | 4 ✅ |
| | Role-based route guards | 2 ✅ (`(app)`), 4 ✅ (`/admin` 403) |
| | Audit log writes | 3 ✅ (`writeAudit`), 4 ✅ · 5 ✅ · 6 ✅ (call sites; hide/mute are E11's, §C-21) |
| | Roles admin / user / moderator | 4 ✅ (global), 6 ✅ (channel-scoped, PR #34), §C-1 |
| | Policy applied to the community actions | 5 ✅ (PR #33) |
| | Different views/actions per role | 4 ✅ (admin vs user, nav link), 5 ✅ · 6 ✅ (B13: member / admin / moderator on one channel) |
| | Helper is a badge, not a tier | 3 ✅ (test); the badge is D14's (§C-21) |
| 3 · OAuth 2.0 | Authorization-code + PKCE for Google | 8 |
| | Same for GitHub | 9 |
| | Callback routes | 8, 9 |
| | Account linking when the email exists | 8.4, 9.4 |
| 4 · 2FA | TOTP enrollment with QR | 10.3 |
| | Verification with drift | 10.2 |
| | 10 single-use recovery codes | 10.4 |
| | Step-up on destructive actions | 11 |
| *(Domain C hygiene)* | C11 rate limit · CSRF · rotation on login | 2 ✅ |
| | C11 rotation on privilege change | 4 ✅ (`invalidateAllSessions` on a global-role change) |
| | C5 ownership guards on documents | 2 ✅ (owner-scoped queries), 3.3 ✅ (evidence, §C-14) |
| *(teammate unblock)* | WS ticket endpoint (C12) | 2.5 ✅ (PR #22; verified by `realtime` since PR #31) |
| *(Amir's module)* | Organization system: E9 channels, E10 threads/votes, E11 moderation | Amir; policy hooks in 5–6, review notes in 7 |

**Deliberately out of scope of this plan:** C13 (the OWASP / `npm audit` / `gitleaks` security review) is a week-5 task with no code dependency. Findings to carry into it: there is no `.dockerignore`, so the Dockerfile's `COPY . .` bakes `.env` and its secrets into the `web` image.

**Total (revised 2026-10-26):** phases 0–6, 12 and task 2.5 are done (≈ 10.25d). Phase 7 is cut (§C-21). Remaining: 8 (≈ 1d after its Keep vs. Cut, was 1.5d) + 9 (1d) + 10 (1.5d) + 11 (0.5d) ≈ **4d**, so ≈ **14.25d** in all, against a Domain C budget of 16d (§7's 15d plus D14's 1d, which moved with the work, §C-22). The original plan was 15.5d plus a 4-day E9–E11 overhang; that overhang is now Amir's, as §7 always intended.
