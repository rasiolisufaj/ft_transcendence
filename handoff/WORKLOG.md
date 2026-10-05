# Session Handoff

_Last updated: 2026-10-02. Owner: Rasiol (auth, permissions, OAuth, 2FA). Plan: [`docs/plans/2026-09-21-rasiol-modules-roadmap.md`](../docs/plans/2026-09-21-rasiol-modules-roadmap.md). This file is the progress record. The roadmap's checkboxes are ticked for phases 0–2.4 (revised 2026-10-02)._

## 🎯 Current Objective
Start **roadmap phase 3**: `can()` / `assertCan()` + `writeAudit()` (C4, C6). Phase 2 (tasks 2.1–2.4) is merged. Before writing code, expand phase 3 into its own TDD plan at `docs/plans/2026-10-01-<task-id>.md`, and **announce `policy.ts` at standup the day it starts** (it blocks all three teammates).

## 📝 Recent Commits & Changes
* `dbefd7d` (2026-09-30, merged by Adrien): **PR #13 merged, phase 2 tasks 2.1–2.4 are on `main`.**
  * `f07b382`: shared Zod schemas, plus `.gitignore`, `CLAUDE.md`, `MEETING_DISCUSSION.md`, the roadmap and this worklog, which are now committed (no longer local-only)
  * `b1cc507`: signup/login/logout server actions
  * `f6aa994`: login and signup forms
  * `3dfd3cc`: the `(app)` route guard; uploads owned by the signed-in user; `seed-user.ts` deleted
  * `8517338`: `docs/testing-auth.md`, a manual test guide for phases 0–2.4
* `767ef90` (2026-09-27): PR #12, `next-intl` routing under `src/app/[locale]/`.
* `9b4c3c4` (2026-09-27): PR #11, document category + extraction status.
* `0dcdb38` (2026-09-25): PR #10, phase 1 (session core).
* 2026-10-02 (not committed): **roadmap revised.** Phases 0–2.4 ticked, each with an *As shipped* note. §A–§D rewritten for the current code. Phase 3 gains a membership rule for posting (§C-15) and task 3.3 (drop `AUTH_STUB`, C5 evidence). Phase 4 moves to `[locale]` + i18n. **Phases 5–7 rewritten**: E9–E11 are Amir's, so they become policy-in-his-actions (with a mapping table), channel roles (C14b) and moderation sign-off. Phases 8–11 adapted (env forwarding in compose, the limiter moved to `lib/auth/rate-limit.ts`, the pending-2FA check in `session.ts`). New §C-11…16.
* 2026-10-01 (not committed): `CLAUDE.md` updated for PR #13 (routes, `schemas.ts`, docs now tracked, phase status, E9–E11 ownership, git author → name map); this worklog rewritten.

## 🛑 Where We Stopped
**Phase 2 merged; phase 3 not started.** No code changes since PR #13.

* **Git state (checked 2026-10-01 after `git fetch --prune`):** `main` = `origin/main` = `feat/auth-login` = `origin/feat/auth-login` = `dbefd7d`. Tree clean apart from the two doc edits above.
  * Start phase 3 on a **new branch from `main`** (e.g. `feat/auth-policy`). `feat/auth-login` is spent.
  * Can be deleted: `origin/feat/auth-login` (merged), `origin/feature-file-storage` (0 ahead, fully merged), local `chore/app-chore-system` (its remote is gone). Local and remote `feat/auth-session-core` are already gone.
* **Task 2.5 (WS ticket, C12) is deferred.** Do it the day Alexandre needs it. `real-time-event-contract` (sku, 1 commit, 2026-10-01) just started `src/contracts/events.ts` + `src/lib/realtime/publish.ts`, so ask him.

### Teammate branches (as of 2026-10-01)
| Branch | Author | vs `main` (behind/ahead) | Notes |
|---|---|---|---|
| `feat/channels` | Amir (khelifi) | 0 / 13, active today | Channels, private channels, invites, join requests, kick, answer editing. 3 migrations: `ChannelInvite`, `ChannelJoinRequest`, `Channel.isPrivate`. |
| `real-time-event-contract` | Alexandre (sku) | 0 / 1, active today | Start of the realtime contract → trigger for task 2.5 |
| `feat/llm-IA-image-Scan` | Adrien (Reaven23) | 12 / 1 | AI image recognition |
| `feat/login-page` | Amir | 37 / 2 | Stale (2026-09-16), superseded by PR #13 |
| `feat/ui-shell` | Alexandre | 39 / 5 | Stale (2026-09-16) |
| `feature/prisma` | Amir | 57 / 1 | Stale (2026-09-09) |

* **`feat/channels` matters for phase 3** (the full action → `assertCan` mapping is now in roadmap phase 5):
  * It settles E9–E11 ownership in practice (Amir builds them), so roadmap phases 5–7 probably drop out. Record that in `MEETING_DISCUSSION.md`.
  * Authorisation is `requireUser()` + inline `role === "MODERATOR"` checks, no `can()`. Phase 3's `Action` union should cover his actions (invite, join request accept/reject, kick, private channel, answer edit) so he can switch to `assertCan()`.
  * Review notes for his PR (full list in roadmap phase 5): ⚠ `requestJoinChannel` takes `userId` from the form instead of the session, parses the channel id from it, and never awaits its `create`; the two new models have no `updatedAt` (review-failure rule); unauthorised actions silently `return` instead of a 403; `package.json` picked up `npm init` junk (`"main": "index.js"`, `author`, `keywords`, `bugs`, `homepage`).

### Open items, owned by others (raise at standup)
* **375 px horizontal scroll on every page (graded).** `src/components/Nav.tsx` (sku/Alex) is ~415 px wide; the auth links from 2.4 made it worse.
* **Prisma client fights between host and Docker.** Fix is infra-owned: an anonymous volume `- /app/src/generated` on `web` in `docker-compose.yml`. Workaround: `docker exec mespapiers_web chown -R 1000:1000 /app/src/generated && npm run db:generate`.
* **Seeded users can't log in** (no `passwordHash`, mixed-case emails). Teammates sign up locally.
* `npm run lint`: 0 errors, 2 warnings in `prisma/seed.ts` (`firstDocument`, `adrienInsuranceDoc` unused). The plan requires zero.
* The `gh` token is still unverified.

### Phase 2 lessons worth keeping
* Actions redirect with `return redirect({ href, locale: await getLocale() })` from `@/i18n/navigation`; the `return` is needed because TS doesn't treat the destructured `redirect` as `never`.
* React 19 resets uncontrolled fields after a form action, so email and display name are controlled inputs; the password is left to be cleared.
* `vitest.config.mts` has `server.deps.inline: ["next-intl"]` (its extensionless `next/navigation` import breaks Node ESM).
* CSRF (C11) is Next's built-in Server Action Origin/Host check. Evidence: a login replayed with `Origin: https://evil.example` is aborted and creates no Session row. Full steps in `docs/testing-auth.md`.
* Dev-only noise, not bugs: `Cannot write to a CLOSED writable stream` after an out-of-browser action POST; `PrismaClientInitializationError` during build with the musl-only client.
* A stale `.next/dev/types` (from before the `[locale]` move) breaks `npm run build`'s typecheck; delete it, `next dev` regenerates it.
