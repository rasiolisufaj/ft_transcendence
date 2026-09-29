# Session Handoff

_Last updated: 2026-09-28 (evening). Owner: Rasiol (auth, permissions, OAuth, 2FA). Plan: [`docs/plans/2026-09-21-rasiol-modules-roadmap.md`](../docs/plans/2026-09-21-rasiol-modules-roadmap.md). This file is the progress record; the roadmap's checkboxes are not ticked._

## 🎯 Current Objective
Start **roadmap phase 2**: signup/login/logout, the `(app)` guard and the WS ticket (C2, C3, C11p, C12). Phase 1 (session core) is merged. Phase 2 now has to sit inside the team's new `app/[locale]/` + `next-intl` routing instead of the flat English routes the roadmap assumed.

## 📝 Recent Commits & Changes
* `0dcdb38` (2026-09-25): **PR #10 merged, phase 1 is on `main`.** It contains `37be36b` (token + SHA-256), `7f1ff0c` (create/validate/invalidate sessions), `ee18f4a` (`getCurrentUser`, `requireUser`, cookie helpers) and `b1dc30f` (sliding expiry removed).
* `9b4c3c4` (2026-09-27, Reaven23): **PR #11 merged.** New migration `20260926124225_add_document_category_and_extraction_status`, which adds the `DocumentCategory` and `ExtractionStatus` enums, `Document.category` / `extractionStatus` and `@@index([ownerId, category])`. It also adds `src/lib/documents/{classify,subtypes}.ts` with tests, and **`src/lib/auth/seed-user.ts`** (`getSeedUser()`, the temporary hardcoded `Amir@gmail.com` owner), which is in my directory.
* `767ef90` (2026-09-27, sku/Reaven23): **PR #12 merged.** `next-intl` ^4 routing under `src/app/[locale]/` (fr/en/es), `messages/{fr,en,es}.json`, `src/i18n/`, a language switcher, and **`src/middleware.ts`** (the next-intl middleware; matcher excludes `api`, `_next` and files).
* `07436b6`: local merge of `main` into `feat/auth-session-core`. **Not pushed, and it doesn't need to be:** the branch tree is identical to `origin/main` (`git diff origin/main HEAD` is empty).
* Files changed this session (all local-only, none committed). `CLAUDE.md` was also corrected for PRs #10–#12 (phase 1 merged, i18n routes, new schema enums, `seed-user.ts`, `allowedDevOrigins` restored):
  * `docs/WORKLOG.md` → `handoff/WORKLOG.md` (moved and rewritten into this template)
  * `CLAUDE.md`: the worklog pointer now says `handoff/WORKLOG.md`
  * Claude memory `feedback-maintain-worklog.md`: same path update

## 🛑 Where We Stopped
**Phase 2: task 2.1 committed (`f07b382`, by Rasiol); task 2.2 written, not committed** (waiting for Rasiol's go-ahead). Next is task 2.3, the forms; Rasiol writes those. Then 2.4 (guard) and 2.5 (WS ticket).

* **Task 2.2 files:** `src/app/[locale]/(auth)/{signup,login,logout}/actions.ts` and `login/actions.test.ts`. It also adds 3 keys to `auth.errors`, a key-parity test in `schemas.test.ts`, and `server.deps.inline: ["next-intl"]` in `vitest.config.mts` (next-intl's extensionless `next/navigation` import breaks Node ESM).
  * Actions redirect with `return redirect({ href, locale: await getLocale() })` from `@/i18n/navigation`. The `return` is needed because the destructured `redirect` has no explicit type, so TS doesn't treat it as `never`.
  * The login rate limit is 6 failures per email per 15 min, in memory, and it prunes expired entries.
  * Evidence: RED → GREEN; both mutants are caught; `npm test` 57/57; eslint, build and typecheck clean.
  * **Seed caveat:** the seeded users have no `passwordHash` and use mixed-case emails, so they can't log in. Sign up a fresh account for the walkthrough.
* **Docs decision made:** `f07b382` also commits `.gitignore`, `CLAUDE.md`, `MEETING_DISCUSSION.md`, the roadmap and this worklog, so they are no longer local-only. CLAUDE.md's Workflow bullet that says they are git-ignored is now stale.
* **Branch:** `feat/auth-login`, cut from `origin/main` @ `767ef90`, no upstream set (so a bare `git push` can't land on `main`). `feat/auth-session-core` is spent and can be deleted locally and on the remote.
* **Tooling state:**
  * `docker` works now and the stack is up.
  * `node_modules` was stale (no `next-intl`); fixed with `npm ci`.
  * The root-owned `src/generated` came back again; fixed with `docker exec mespapiers_web chown -R 1000:1000 /app/src/generated && npm run db:generate` (no sudo).
  * `.next/dev/types` was stale from before the `[locale]` move, which made `npm run build` fail typecheck. I deleted it; `next dev` regenerates it.
  * The `gh` token is still unverified.
