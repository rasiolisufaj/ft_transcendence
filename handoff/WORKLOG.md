# Session Handoff

_Last updated: 2026-10-05. Owner: Rasiol (auth, permissions, OAuth, 2FA). Plan: [`docs/plans/2026-09-21-rasiol-modules-roadmap.md`](../docs/plans/2026-09-21-rasiol-modules-roadmap.md). This file is the progress record. The roadmap's checkboxes are ticked for phases 0–3 (revised 2026-10-05)._

## 🎯 Current Objective
**Roadmap phase 4** (admin surface, C14a) and **task 2.5** (WS ticket, C12), which is due now that Alexandre's realtime server is merged. Phase 3 is merged (PR #18). Phase 5 is unblocked (Amir's channels merged in PR #9). Expand each into its own TDD plan under `docs/plans/` before writing code. Still owed from phase 3: **the standup announcement of `policy.ts` with §C-17/18**, and the phase 5 mapping table for Amir.

## 📝 Recent Commits & Changes
* 2026-10-05 (not committed, on `chore/docs`): `main` merged into `chore/docs` (staged, not committed), and `CLAUDE.md`, the roadmap and this worklog checked against `main` and updated. Roadmap phase 3 ticked with an *As shipped* note.
* `90a0142` (2026-10-05, all merged by Adrien): `main` jumps 51 commits.
  * PR #18 `e11c60b`: **phase 3** (`c227302` policy, `64f8b80` audit, `18783f6` drop `AUTH_STUB`, `7894246` `testing-auth.md`, `229f185` truth table, `508bec0` review fixes)
  * PR #9: Amir's channels (E9), three migrations, `prisma/seed.ts` rewritten
  * PR #20: Adrien's AI extraction (`src/lib/ai/`), called by `classifyDocument()`; the `add_document_deadline` migration (`DeadlineType`, `targetDate`)
  * PRs #15, #16: Alexandre's `src/contracts/events.ts` and the `ws` server in `src/realtime/` (no auth on connect)
  * PR #14 `npm run i18n:check`, PR #17 responsive nav (`MobileMenu`), PR #19 gallery and `Dialog` focus fixes
  * After pulling: `npm install`, `npm run db:migrate`, `npm run db:generate`
* `1a06759` (2026-10-03, `chore/docs`, no PR yet): phase 3 rulings, auth test guide and worklog.
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
**Task 2.5 (WS ticket), 2026-10-05, branch `feat/auth-ws-ticket` (from `main` = `2f9acc9`): one commit, `feat(auth): mint single-use websocket tickets for the realtime process` (first `6a8396e`, then amended to add `.env.example`, this worklog and the `CLAUDE.md` rule change), not pushed.** `src/lib/auth/ticket.ts` + `ticket.test.ts` (5 tests; three mutants each caught), `POST /api/auth/ws-ticket` (`Response.json`, like the documents route), `WS_TICKET_SECRET` set in `.env` and forwarded to `web` in `docker-compose.yml` as `"${WS_TICKET_SECRET:-}"`. `npm test` 153/153, build + tsc clean, lint unchanged (the known channels errors). Live on mespapiers.local: 401 without a cookie, 405 on GET; 200 + a ticket that verifies once and is `null` on replay. The real `ANTHROPIC_API_KEY` was taken out of `.env.example` before the commit (`git log -p main..HEAD` has no `sk-ant-usr`). `WS_TICKET_SECRET` is uncommented in `.env.example`. **Next:** push, PR, and tell Alexandre: the roadmap's step 7 contract, plus realtime needs the same `WS_TICKET_SECRET` (`npm run realtime` does not load `.env`) and nginx has no `/ws` block yet. Manual test: curl POST without a cookie (401) and GET (405), a browser `fetch("/api/auth/ws-ticket", { method: "POST" })` when signed in, then `npx tsx --env-file=.env -e` calling `verifyTicket` twice in one process (`{userId}`, then `null`).
* **Rule change, 2026-10-05:** `docs/` and `handoff/` (and `CLAUDE.md`) are committed and pushed with the work, in the feature PR. No more `chore/docs` batching; `CLAUDE.md` updated.
**Phase 3 merged (PR #18, `e11c60b`, 2026-10-05).** The history of how it got there:
* 3.3: `.env.example` drops `AUTH_STUB` (the feature commit). `docs/testing-auth.md` now covers phases 0–3 and uses **`https://mespapiers.local`** throughout (Rasiol's rule: never localhost). It gains B10 (the two-account C5 check), A2 break-it checks for policy and audit, A4 (try `can()` with `npx tsx -e`, and write a demo audit row), and Part A counts (74 total, auth 6 files / 42 tests). It and the `CLAUDE.md` line stay uncommitted (chore/docs). C5 run, 2026-10-03, in real Chromium on mespapiers.local: B reading A's doc gets 404; B deleting A's doc gets **500** with Next's error overlay and 2 console errors, and nothing is deleted; the controls get 200 and → `/fr`; CSRF with a foreign Origin is aborted. Full evidence is in the SDD ledger.
* ⚠ For Amir: a refused `deleteDocument` throws a plain `Error`, so the user gets a 500 error page instead of a 403/404. For Adrien: B10's assistant must `assertCan(ctx, "document:read", doc)` before putting a document in a prompt.
* 3.1: `src/lib/auth/policy.ts` + `policy.test.ts` (15 tests; the plan's 14 + "user:manage is admin-only, even on your own account", found by a mutation check). `Action` is derived from one `as const` list.
* 3.2: `src/lib/audit.ts` (`writeAudit`) + `audit.test.ts` (2 DB tests, not in the plan). `metadata` is typed `Prisma.InputJsonObject`; the plan's `Record<string, unknown>` fails tsc. **Callers that delete a user must write the audit row first**, or the actor FK rejects it silently. `npm test` 74/74, lint 0 errors, build + typecheck clean.
* 2026-10-03: Rasiol committed and pushed 3.3 (`18783f6`, `7894246`). No PR yet. The exit gate's "truth table for every Action × every role" (C4 Done-when) wasn't met: 7 of the 23 actions were never tested. A `truth table` block now in `policy.test.ts` (uncommitted) has one row per Action, with the resource the caller passes and the answer for admin / moderator / member / owner / stranger. It is typed `Record<Action, …>`, so a new Action without a row fails tsc. `npm test` 97/97 (auth 65); `testing-auth.md` counts updated.
* 2026-10-03: Rasiol committed the truth table (`229f185`). Final review (fresh Opus reviewer): **with fixes**, 1 Critical + 2 Important, all verified. Rasiol: "apply all the fixes". **Fix 1 done (uncommitted): the document vault is owner-only, even for an admin** (vision §3 over §5's "ADMIN wins everywhere"; roadmap §C-17). **Must be announced to the team.** **Fix 2 done (uncommitted): moderation is never granted by ownership** (`channel:moderate` / `channel:manageRoles` stop after tier 2). **Fix 3 done (uncommitted): `channel:manageRoles` is admin-only** (roadmap §C-18; task 6.1 updated). **Must be announced to the team.** `npm test` 99/99 (auth 67). The fix pass is complete; the 8 minors are in the SDD ledger, deferred.
* 2026-10-03: Rasiol committed and pushed the fixes (`508bec0`). Docs flushed to `chore/docs` (CLAUDE.md, roadmap §C-17/18 + task 6.1, `testing-auth.md`, this worklog); they stay as uncommitted edits on `feat/auth-policy`. **Merge the `chore/docs` PR before the phase 3 PR:** `feat/auth-policy` was cut from `chore/docs`, so its PR diff shows `c54b0b5`'s docs until then. `testing-auth.md` drops out only after **Update branch** (merge `main` into it). This only affects the diff a reviewer sees; nothing breaks in either order. (Moot: PR #18 merged first, on 2026-10-05.)
* Next: (1) the standup announcement of `policy.ts` with §C-17/18, and the phase 5 mapping for Amir; (2) task 2.5; (3) phase 4; (4) phase 5. Commit the `chore/docs` merge and doc edits, then open its PR (`gh` isn't logged in: run `gh auth login` or use the web compare page). Rulings are in the SDD ledger (`.superpowers/sdd/2026-09-21-rasiol-modules-roadmap/progress.md`).

* **Git state (checked 2026-10-05 after `git fetch --prune`):** `main` = `origin/main` = `90a0142`. `chore/docs` = `origin/chore/docs` = `1a06759`, plus a merge of `main` staged and the doc edits uncommitted. `stash@{0}` is a backup of these docs taken on 2026-10-05; `stash@{1}` is an old worklog stash from `feat/auth-login`.
  * Start task 2.5 and phase 4 on **new branches from `main`**. Local `feat/auth-policy` and `feat/auth-login` are merged and spent.
  * Can be deleted: local `feat/auth-policy` and `feat/auth-login`, `origin/feat/auth-login` (0 ahead), `origin/feature-file-storage` (0 ahead).
* **Task 2.5 (WS ticket, C12) is due now.** Alexandre's `src/realtime/` (PR #16) accepts any connection, and `src/lib/realtime/publish.ts` is a no-op stub. Agree the handshake with him.

### Teammate branches (as of 2026-10-05, after `git fetch --prune`)
| Branch | Author | vs `main` (behind/ahead) | Notes |
|---|---|---|---|
| `friends` | Alexandre (sku) | 0 / 8, active today | Friends page |
| `feature-file-storage` | Amir | 70 / 0 | Fully merged, can be deleted |
| `feat/login-page` | Amir | 88 / 2 | Stale (2026-09-16), superseded by PR #13 |
| `feat/ui-shell` | Alexandre | 90 / 5 | Stale (2026-09-16) |
| `feature/prisma` | Amir | 108 / 1 | Stale (2026-09-09) |

Merged on 2026-10-05 and deleted: `feat/channels`, `real-time-event-contract`, `realtime-server`, `feat/llm-IA-image-Scan`, `i18n-check`, `responsive-nav`, `ui-gallery`, `feat/auth-policy`.

* **Amir's channels (PR #9) and phase 5** (the full action → `assertCan` mapping is in roadmap phase 5):
  * E9–E11 are Amir's in practice; E10 (votes) and E11 (hide/mute) are not started. Still to do: record the decision in `MEETING_DISCUSSION.md`.
  * Every check is still inline (`role === "MODERATOR"`, `createdBy`), so all of phase 5's table is to do.
  * Review notes, checked 2026-10-05: ✅ `requestJoinChannel` now uses the session user and awaits its `create`; ✅ the `npm init` junk is gone. Still open: no `updatedAt` on `ChannelInvite` / `ChannelJoinRequest` (review-failure rule); refusals silently `return` instead of a 403; duplicate `kick` and `deleteChannel` actions; bare `revalidatePath("/channels…")` paths.

### Open items, owned by others (raise at standup)
* **375 px horizontal scroll (graded).** PR #17 (responsive nav, `MobileMenu`) targets it. Recheck at 375 px.
* **Prisma client fights between host and Docker.** Fix is infra-owned: an anonymous volume `- /app/src/generated` on `web` in `docker-compose.yml`. Workaround: `docker exec mespapiers_web chown -R 1000:1000 /app/src/generated && npm run db:generate`.
* **Seeded users can't log in** (no `passwordHash`, mixed-case emails). Teammates sign up locally. Roadmap task 4.1 step 2 fixes it, now unblocked.
* `npm run lint`: **1 error** (`react/no-unescaped-entities` in `channels/[id]/requests/page.tsx`) and 12 warnings, all under `(app)/channels/` (Amir). The `prisma/seed.ts` warnings are gone. The plan requires zero.
* `.env.example` lacks `REALTIME_PORT` and `HEARTBEAT_MS`, which `src/realtime/main.ts` reads (Alexandre).
* `gh` is not logged in (401 on 2026-10-05): run `gh auth login`.

### Phase 2 lessons worth keeping
* Actions redirect with `return redirect({ href, locale: await getLocale() })` from `@/i18n/navigation`; the `return` is needed because TS doesn't treat the destructured `redirect` as `never`.
* React 19 resets uncontrolled fields after a form action, so email and display name are controlled inputs; the password is left to be cleared.
* `vitest.config.mts` has `server.deps.inline: ["next-intl"]` (its extensionless `next/navigation` import breaks Node ESM).
* CSRF (C11) is Next's built-in Server Action Origin/Host check. Evidence: a login replayed with `Origin: https://evil.example` is aborted and creates no Session row. Full steps in `docs/testing-auth.md`.
* Dev-only noise, not bugs: `Cannot write to a CLOSED writable stream` after an out-of-browser action POST; `PrismaClientInitializationError` during build with the musl-only client.
* A stale `.next/dev/types` (from before the `[locale]` move) breaks `npm run build`'s typecheck; delete it, `next dev` regenerates it.
