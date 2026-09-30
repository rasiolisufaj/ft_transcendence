# Session Handoff

_Last updated: 2026-09-29 (evening). Owner: Rasiol (auth, permissions, OAuth, 2FA). Plan: [`docs/plans/2026-09-21-rasiol-modules-roadmap.md`](../docs/plans/2026-09-21-rasiol-modules-roadmap.md). This file is the progress record; the roadmap's checkboxes are not ticked._

## 🎯 Current Objective
Start **roadmap phase 2**: signup/login/logout, the `(app)` guard and the WS ticket (C2, C3, C11p, C12). Phase 1 (session core) is merged. Phase 2 now has to sit inside the team's new `app/[locale]/` + `next-intl` routing instead of the flat English routes the roadmap assumed.

## 📝 Recent Commits & Changes
* `f07b382`, `b1cc507`, `f6aa994`, `3dfd3cc` (2026-09-29, `feat/auth-login`, not pushed): phase 2 tasks 2.1–2.4: shared Zod schemas, signup/login/logout actions, the forms, the route guard.
* `0dcdb38` (2026-09-25): **PR #10 merged, phase 1 is on `main`.** It contains `37be36b` (token + SHA-256), `7f1ff0c` (create/validate/invalidate sessions), `ee18f4a` (`getCurrentUser`, `requireUser`, cookie helpers) and `b1dc30f` (sliding expiry removed).
* `9b4c3c4` (2026-09-27, Reaven23): **PR #11 merged.** New migration `20260926124225_add_document_category_and_extraction_status`, which adds the `DocumentCategory` and `ExtractionStatus` enums, `Document.category` / `extractionStatus` and `@@index([ownerId, category])`. It also adds `src/lib/documents/{classify,subtypes}.ts` with tests, and **`src/lib/auth/seed-user.ts`** (`getSeedUser()`, the temporary hardcoded `Amir@gmail.com` owner), which is in my directory.
* `767ef90` (2026-09-27, sku/Reaven23): **PR #12 merged.** `next-intl` ^4 routing under `src/app/[locale]/` (fr/en/es), `messages/{fr,en,es}.json`, `src/i18n/`, a language switcher, and **`src/middleware.ts`** (the next-intl middleware; matcher excludes `api`, `_next` and files).
* `07436b6`: local merge of `main` into `feat/auth-session-core`. **Not pushed, and it doesn't need to be:** the branch tree is identical to `origin/main` (`git diff origin/main HEAD` is empty).
* Files changed this session (all local-only, none committed). `CLAUDE.md` was also corrected for PRs #10–#12 (phase 1 merged, i18n routes, new schema enums, `seed-user.ts`, `allowedDevOrigins` restored):
  * `docs/WORKLOG.md` → `handoff/WORKLOG.md` (moved and rewritten into this template)
  * `CLAUDE.md`: the worklog pointer now says `handoff/WORKLOG.md`
  * Claude memory `feedback-maintain-worklog.md`: same path update

## 🛑 Where We Stopped
**Phase 2: 2.1 (`f07b382`), 2.2 (`b1cc507`) and 2.3 (`f6aa994`) committed. Task 2.4 (the route guard) committed as `3dfd3cc`** (`feat/auth-login`, not pushed). Next: 2.5 (WS ticket), only when Alexandre starts D2.

* **Task 2.4 files:** `git mv` of the dashboard and `documents/` into `src/app/[locale]/(app)/`, plus a new `(app)/layout.tsx` (`await requireUser()`). `getSeedUser()` is replaced by `requireUser()` in the dashboard, the category page, `uploadDocument` (first line) and `deleteDocument`, and `seed-user.ts` is deleted. `/api/documents/[id]` answers 401 with no session and 404 for a foreign document (it threw a 500 before). `Nav.tsx` is async and shows Sign in/Sign up or name + Sign out, with `flex-wrap`. `nav.login|signup|logout` added in fr/en/es. CLAUDE.md updated.
  * ⚠ **Other people's files, flag in the PR and tag them:** the moved pages, `new/actions.ts`, `action.ts` and `api/documents/[id]/route.ts` (Amir); `Nav.tsx` (sku/Alex). Teammates now have to sign up locally, since the seeded `Amir@gmail.com` can't log in.
  * Every route is now dynamic (`ƒ`), because the root nav reads the cookie. This is what plan step 5 asks for.
  * The layout is not the security boundary: in Next 16 a layout doesn't stop its page from rendering. Each page, action and route checks the session itself.
  * Evidence: RED with no session gave `/api/documents/1` → 200 image/png (Amir's file, served to anyone). GREEN: 307 → `/login`, 401, and `/es/…` → `/es/login` (so `requireUser()` needed no locale fix). Playwright walkthrough: uploads are owned by the signed-in user, Amir's file is 404, logout deletes the Session row, 0 px overflow at 375/768/1440, console 0 on fr/en/es. `npm test` 57/57, build and typecheck clean, lint has 0 errors.
  * **CSRF evidence for the PR (C11):** a real login request replayed with `Origin: https://evil.example` gets `HTTP/1.1 500` and the server logs ``x-forwarded-host` header with value `localhost` does not match `origin` header with value `evil.example` from a forwarded Server Actions request. Aborting the action.`` No Session row is created. The same replay with its own Origin creates one (control).
  * **`docs/testing-auth.md`** (new, not committed): a guide to testing phases 0–2.4 by hand, for reviewers. Part A covers the automated tests and mutation checks; Part B is a browser walkthrough with SQL/curl checks, including the CSRF replay. Link it from the PR.
  * Dev-only noise, not bugs: an action POST from outside the browser makes an idle dev tab log `Cannot write to a CLOSED writable stream` (React debug channel). The build's `PrismaClientInitializationError` lines come from the musl-only client; there are 0 after a host `db:generate`.

* **Task 2.3 files:** `src/app/[locale]/(auth)/{login,signup}/page.tsx` (client pages, `useActionState`, statically prerendered for fr/en/es), plus `auth.fields`, `auth.login` and `auth.signup` in `messages/*.json`.
  * They use Input's own `label`/`error` props (aria-describedby is already wired up). Errors are schema keys rendered through `t("errors.<key>")`.
  * Email and display name are **controlled** because React 19 resets uncontrolled fields after every form action, so a wrong password would otherwise wipe them too. The password is left to be cleared.
  * Evidence: lint, `npm test` 57/57, build and typecheck are clean.
  * **Browser check on https://mespapiers.local (Playwright Chromium, from the session scratchpad; not a project dependency):** all passed.
    * signup: a short password shows the error, display name and email are kept, the password is cleared, and `aria-invalid` is set
    * signup: Enter submits and lands on `/fr`
    * `mp_session` is `HttpOnly`, `Secure` and `Lax`, and JS can't read it; `Session.id` = sha256(cookie)
    * login: a wrong password shows the generic error and keeps the email; the right one lands on `/en` and creates a second, different Session row
    * keyboard: Tab order is display name > email > password > submit > link
    * **console:** zero warnings or errors on `/fr|en|es/login`, `/fr|en/signup`, `/fr` and `/en` (only React's DevTools info and HMR logs)
  * **⚠ Graded, not caused by 2.3: horizontal scroll at 375 px on every page.** The shared `Nav` (links plus LocaleSwitcher) is 415 px wide, so the language button is cut off. It's `src/components/Nav.tsx` (not mine), and 2.4 will add auth links to it, which makes it worse. Raise it with the team.
* **Prisma client is now generated by the container** (restarted `web` on 2026-09-29, then `chown` back to 1000). Docker works, but **host DB tests fail** until `npm run db:generate`, and that breaks Docker again. The cause is the shared bind mount: the generated client embeds the absolute output path of whoever ran `generate`.
  * Real fix, infra-owned: an anonymous volume `- /app/src/generated` on `web` in `docker-compose.yml`, so host and container stop sharing the generated client.
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
