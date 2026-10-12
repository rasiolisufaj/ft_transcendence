# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MesPapiers** is a 42 `ft_transcendence` group project (4 people, 5 weeks). It helps people deal with French paperwork. It has two parts: a private document vault (AI extraction, deadline tracking, a streaming assistant) and a mutual-aid community (channels, threads, DMs, moderation). The specs are:

- [`mespapiers_project_vision.md`](mespapiers_project_vision.md): the product spec
- [`subject_requirements.md`](subject_requirements.md): the graded 42 requirements
- [`PROJECT_PLAN.md`](PROJECT_PLAN.md): the architecture, schema design, published interfaces, work breakdown and owners. It is the source of truth for target design. Read the relevant section before building a feature.

The plan has this rule for agents: when a WBS task from `PROJECT_PLAN.md` §7 is given to an agent, first expand it into a per-task TDD plan at `docs/plans/YYYY-MM-DD-<task-id>.md`. Do not implement straight from a WBS row. `docs/plans/2026-09-21-rasiol-modules-roadmap.md` shows the format (phases 0–4 have full TDD steps). Its §C lists where it departs from the plan's wording.

## Current state vs. target

The repo is **partly built**: auth, documents, channels and a first realtime server are on `main`, but much of `PROJECT_PLAN.md` still does not exist. Check the code before you assume a plan item is there.

**What exists:**

- `prisma/schema.prisma` holds 18 models and 7 enums, applied by seven migrations: `20260918122806_init`, `20260919114739_add_file_hash` (`Document.fileHash`, not unique), `20260925182601_add_channel_invite`, `20260926124225_add_document_category_and_extraction_status`, `20260927093444_add_document_deadline`, `20260930115457_add_channel_is_private` and `20261001113819_add_channel_join_request`. The models cover the community layer (`Channel` with `isPrivate`, `ChannelMember`, `ChannelInvite`, `ChannelJoinRequest`, `Thread`, `Answer`, `Vote`, `Friendship`, `Conversation`, `Message`, `Notification`), auth storage (`Session`, `OAuthAccount`, `AuditLog`, plus `User.passwordHash` / `totpSecret` / `totpEnabled` / `globalRole` / `reputation`), and class-table inheritance for documents (`DocumentIdentity`, `DocumentInsuranceAuto`). `Document` also has `category` (`DocumentCategory`: `IDENTITY · INSURANCE_AUTO · OTHER`, default `OTHER`) and `extractionStatus` (`ExtractionStatus`: `PENDING · NEEDS_REVIEW · CONFIRMED · FAILED`), indexed on `[ownerId, category]` (PR #11), plus `targetDate` and `deadlineType` (`DeadlineType`: `HARD · SOFT · PERIODIC · NONE`; the schema comment gives the `deriveStatus()` truth table), indexed on `[deadlineType, targetDate]` for the deadline scan.
- `prisma/seed.ts` (rewritten by Amir in PR #9): ten users (`amir@gmail.com`… lowercase, all with the dev password `motdepasse123`; `rasiol@gmail.com` is the only `ADMIN`, roadmap task 4.1), five channels with threads, an invite, two answers, a vote, no documents. It is **not idempotent** — no cleanup, so a second run fails on the unique `email`. `prisma.config.ts` registers it as the Prisma seed, so `npm run db:reset` resets **and** seeds; do not run `db:seed` after it.
- `src/lib/auth/` (roadmap phases 1–2, merged in PRs #10 and #13): `password.ts` (argon2id via `@node-rs/argon2`), `session.ts` (`createSession`, `validateSessionToken`, `invalidateSession(s)`, `getCurrentUser`, `requireUser`, `setSessionCookie`, `clearSessionCookie`) and `schemas.ts` (the shared Zod module for signup and login; error messages are i18n keys under `auth.errors`). `Session.id` stores `SHA-256(token)`; the raw token lives only in the `mp_session` cookie. Sessions last 30 days from login and are **never extended**. `SessionContext` carries `memberships`. The login rate limit (6 failures per email per 15 min) is in memory, in `login/actions.ts`.
- **Policy and audit (roadmap phase 3, PR #18):** `src/lib/auth/policy.ts` has `can()`, `assertCan()` and `ForbiddenError` (403), default-deny over a 23-member `Action` union derived from one `as const` list. The vault (`document:read/update/delete`) is owner-only, admin included (roadmap §C-17); `channel:manageRoles` and `user:manage` are admin-only (§C-18); posting needs a membership (§C-15). `src/lib/audit.ts` has `writeAudit()` (`metadata` is `Prisma.InputJsonObject`). Only the admin surface calls them so far (phase 4); phase 5 wires them into the channel actions.
- `src/lib/documents/` (PR #11): `subtypes.ts` is the category registry (a new category = one enum value + one registry entry; the dashboard card, URL and classification prompt derive from it). `classify.ts` has `classifyDocument()`, which calls `extractDocument()` from `src/lib/ai/extract.ts` (PR #20, Adrien; plan B3). `src/lib/ai/client.ts` holds the `@anthropic-ai/sdk` client and `EXTRACTION_MODEL = "claude-opus-5"`. Without `ANTHROPIC_API_KEY` the upload still succeeds and the document stays `PENDING`. `extract.test.ts` mocks the client.
- **Realtime (PRs #15, #16, Alexandre):** `src/contracts/events.ts` holds the `RealtimeEvent` union plus `channelTopic`, `userTopic` and `topicFor`. `src/realtime/` is a bare `ws` server (`npm run realtime`, port `REALTIME_PORT` default 3001, heartbeat, JSON logs, graceful shutdown) that only says `hello`: **no authentication on connect** (the roadmap's task 2.5 ticket, `src/lib/auth/ticket.ts` + `POST /api/auth/ws-ticket`, is in PR #22; nothing calls `verifyTicket()` yet), no topics, not in compose, no nginx `/ws`. `src/lib/realtime/publish.ts` is a no-op stub. `REALTIME_PORT` and `HEARTBEAT_MS` are missing from `.env.example`.
- **i18n (PR #12):** `next-intl` ^4, locales `fr` (default), `en`, `es` in `src/i18n/config.ts`, `localePrefix: "always"` (every URL starts with `/fr`, `/en` or `/es`), `timeZone: "Europe/Paris"`. Catalogues are `messages/{fr,en,es}.json`. `src/middleware.ts` is the next-intl middleware; its matcher skips `api`, `_next` and paths with a dot. `npm run i18n:check` (`scripts/i18n-check.ts`, PR #14) reports keys missing from `en`/`es`, orphan keys and unused keys.
- Vitest (`vitest.config.mts`, `src/**/*.test.ts`), and `zod` ^4 (v4 API) as a direct dependency.
- Routes, all under `src/app/[locale]/` except the API:
  - `(app)/` group, signed-in only: `/[locale]` (dashboard), `/[locale]/documents/new` (upload), `/[locale]/documents/[category]` (one category's list), `/[locale]/documents/error-*` (upload error pages)
  - `(app)/channels/` (Amir, PR #9): the list, `create`, `join`, `invitations`, and `[id]` with `edit`, `delete`, `invite`, `kick`, `requests` and `answers/[answerId]/edit`. Every check is inline (`role === "MODERATOR"`, `createdBy`), and a refusal is a silent `return`.
  - `(app)/admin/` (roadmap phase 4): `layout.tsx` renders a translated 403 card for non-admins (§C-2), and `users/` is the user list (search, promote/demote, two-step delete) with `setGlobalRole` / `deleteUser` in `actions.ts`, each `assertCan(ctx, "user:manage")` + `writeAudit`. The nav shows *Administration* to admins only, in the account dropdown (`UserMenu`) and the ☰ panel (below 768 px, `md`).
  - `(auth)/` group: `/[locale]/login`, `/[locale]/signup` (client pages, `useActionState`), and the `logout` action
  - `/[locale]/dev/ui` (component gallery) and `/api/documents/[id]` (file download, not localised)
  - There is no `src/app/layout.tsx`; `src/app/[locale]/layout.tsx` is the root layout. Every route renders dynamically, because the root `Nav` reads the session cookie.

**What does not exist:**

- OAuth and TOTP (the WS ticket, roadmap task 2.5, is in PR #22, not yet on `main`). Also missing: Redis, the `worker` process, `src/lib/storage/`, `src/lib/ai/assistant.ts`, `lib/documents/schemas.ts`, `lib/documents/status.ts` (`deriveStatus()`), Playwright.
- `AUTH_STUB` is **not** built, and roadmap task 3.3 removed it from `.env.example`. Log in as a seeded user instead (`<name>@gmail.com` / `motdepasse123`, after `npm run db:reset`), or sign up at `/[locale]/signup`.
- **Document auth is session-only: `assertCan()` exists but is not called** (phase 5). The app routes sit in the `src/app/[locale]/(app)/` group, whose layout calls `requireUser()`. That layout is not the boundary (it neither stops the page from rendering nor re-runs on client navigation), so the dashboard, the category page, `uploadDocument` (`documents/new/actions.ts`) and `deleteDocument` (`src/app/[locale]/action.ts`) each call `requireUser()` and scope queries by `ownerId`. `GET /api/documents/[id]` answers 401 without a session and 404 for a missing or foreign document. The file route is `/api/documents/[id]`, not the plan's `/api/documents/[id]/file`. The magic-byte check accepts pdf, png and jpeg but **not webp**.

**Where the schema still departs from plan §3/§5** — relevant if you are building auth or documents:

- `User.locale` is `String @default("fr")`, not the `Locale` enum the published interfaces assume.
- No `Document.version` (optimistic concurrency, 409 on conflict), and no `@@unique([documentId, kind])` on `Notification`. `DeadlineType` exists and adds `NONE`, which plan §3 lacks.
- `ChannelInvite` and `ChannelJoinRequest` have no `updatedAt` (a review-failure rule).
- Files are still raw bytes in `Document.fileData`. `MEETING_DISCUSSION.md` records the team decision to keep it that way for now; MinIO is optional and later, not a blocker.

## Commands

```bash
npm install
npm run db:generate      # REQUIRED after install and after any schema change (client is git-ignored)
npm run dev              # http://localhost:3000
npm run build
npm run lint             # eslint flat config; single file: npx eslint src/path/to/file.tsx
npm run i18n:check       # missing / orphan / unused message keys
npm run realtime         # the WebSocket server (tsx src/realtime/main.ts)
npm run typecheck        # run `npm run build` first (see below)
npm run db:migrate       # prisma migrate dev
npm run db:studio
npm run db:reset         # prisma migrate reset --force (destroys local data, then runs the seed)
npm test                 # vitest run
npx vitest run src/lib/auth/session.test.ts      # one file
npx vitest run -t "never extends"                # tests whose name matches
```

DB tests (e.g. the session lifecycle ones) hit the real Postgres from `.env` (`vitest.setup.ts` loads it through `dotenv`), so `db` must be up and migrated. Test files run serially (`fileParallelism: false`) because they share that database. Each test creates its own `test-<uuid>@mespapiers.test` user and deletes it afterwards.

**Full stack in Docker:** run `cp .env.example .env`, then `docker compose up --build`. This starts three services:

- `db`: Postgres 17, published on host port 5432
- `web`: runs `npm run dev`, not `next start`. `src/`, `public/` and `prisma/` are bind-mounted, so hot reload works.
- `nginx`: terminates TLS on 443 and redirects 80 to 443

Open `https://mespapiers.local`, which needs an `/etc/hosts` entry, or `https://localhost`. If mkcert certs named `mespapiers.local+1.pem` and `mespapiers.local+1-key.pem` are in the `nginx-certs` named volume, `infra/nginx/entrypoint.sh` uses them. Otherwise it generates a self-signed cert. Compose does not mount `infra/nginx/certs/`, so certs saved there are ignored.

- The containers do **not** run migrations. Apply them from the host with `npm run db:migrate`. `DATABASE_URL` in `.env` points at `localhost:5432`. Inside compose, `web` gets its own `DATABASE_URL` pointing at `db:5432`.
- `prisma.config.ts` loads `.env` through `dotenv`. The Prisma CLI reads `DATABASE_URL` from there.

## Gotchas

- **Next.js 16 / React 19.** Next 16 breaks many patterns found in older tutorials and training data. Once dependencies are installed, the version-accurate docs are in `node_modules/next/dist/docs/`. Check them before writing App Router code.
- **Typecheck ordering.** `next build` generates the global route types (`LayoutProps<"/">`, `PageProps`) into `.next/types`. The root layout already uses them (`LayoutProps<"/[locale]">`). On a clean checkout, `tsc --noEmit` fails until a build has run. CI must run `next build` before typecheck.
- **Prisma client import path.** `schema.prisma` uses the new `prisma-client` generator, which outputs to `src/generated/prisma/` (git-ignored). Import from `@/generated/prisma/client`, **not** `@prisma/client`. The plan's §5 snippets use `@prisma/client`, but that path does not match this setup. Use the singleton `prisma` exported from `src/lib/db.ts`.
- **Prisma engine flips between host and container.** The `web` container runs `prisma generate` on every start (Dockerfile `CMD`). Because `src/` is bind-mounted, that overwrites `src/generated/prisma/` with the Alpine engine only (`linux-musl-openssl-3.0.x`). Prisma code then fails on the host with `could not locate the Query Engine for runtime "debian-openssl-3.0.x"`. The container runs as root, so the regenerated files are also root-owned, and host `prisma generate` fails with `EACCES: permission denied, unlink`. To fix both, run `sudo chown -R $USER:$USER src/generated`, then `npm run db:generate`. Without `sudo` (it asks for a password), while the stack is up, let the root container do the chown: `docker exec mespapiers_web chown -R $(id -u):$(id -g) /app/src/generated`, then `npm run db:generate`. The symptom in `npm test` is that every DB test (session, audit, login rate limit) fails with that error and the pure tests pass. The problem comes back the next time the container starts.
- **Prisma `binaryTargets`.** `schema.prisma` sets `["native", "linux-musl-openssl-3.0.x", "darwin"]`. `native` resolves at generate time, which is the mechanism behind the engine flip above: a generate inside the Alpine container produces the musl engine only, and `debian-openssl-3.0.x` is never in the list.
- **`next.config.ts`** pins `turbopack.root` to prevent warnings from stray parent lockfiles, sets `allowedDevOrigins: ["mespapiers.local"]` (HMR through nginx), raises `serverActions.bodySizeLimit` to `10mb` to match the upload limit, and is wrapped in `createNextIntlPlugin()`. Do not enable `output: 'standalone'`: the planned `realtime` and `worker` processes run from the same image with `tsx` and need the full `node_modules`.
- **Session cookie is `Secure` always**, not only in production. Compose runs `next dev` behind nginx TLS, so a `NODE_ENV` check would never set it. Browsers accept `Secure` cookies on `http://localhost`. Cookies can only be set in Server Actions and Route Handlers, never during render. That is why sessions do not slide.
- **A layout check does not protect its page's data.** A layout that returns something else instead of `children` still lets the page run, and the page's output still reaches the browser in the RSC payload (Next `guides/authentication.md`, "Layouts and auth checks"). Task 4.3 proved it: without its own `can()`, `/admin/users` showed a USER the 403 card while the HTML carried every user's email. A page that reads privileged data checks `can()` itself.
- **Localised navigation.** Import `Link`, `redirect`, `usePathname` and `useRouter` from `@/i18n/navigation`, not `next/link` / `next/navigation`, so the locale is kept. `requireUser()` calls `next/navigation`'s `redirect("/login")` without a locale; the middleware adds the prefix from its locale cookie (verified in task 2.4: `/es/documents/new` → `/es/login`).
- **Typed messages.** `src/i18n/global.d.ts` types `t()` keys against `messages/fr.json`, so an unknown key fails the typecheck. Add a key to `fr.json` first, then to `en.json` and `es.json`.
- **Static rendering with next-intl.** Every statically rendered page (not only the layout) calls `enableStaticRendering(locale)` from `@/i18n/static`. Otherwise next-intl reads the locale from the headers and the page becomes dynamic.
- **`middleware.ts` is deprecated in Next 16** and renamed `proxy.ts` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). `src/middleware.ts` still uses the old name.
- **Vitest config must stay `.mts`.** A `.ts` config loads as CommonJS and warns.
- **Line endings.** `.gitattributes` forces LF on `*.sh`, and `entrypoint.sh` fails in the Alpine container with CRLF. Some team members work on Windows.
- `tsconfig` sets `strict` and `noUncheckedIndexedAccess`. Indexed access returns `T | undefined`.
- `npm run lint` is bare `eslint` — flat config, lints the working directory.
- **nginx has no `/ws` block yet.** Everything goes through `location /` to `web:3000`. `client_max_body_size` is 20M while the app limit is 10 MB, so an oversized upload is rejected by the app, not by the proxy.
- `prisma/seed.ts` constructs its own `PrismaClient` from `../src/generated/prisma/client` instead of importing the `src/lib/db.ts` singleton. That is correct for a standalone script — do not "fix" it.

## Architecture (target, per PROJECT_PLAN.md)

- **One npm package, one Docker image, three processes:**
  - `web`: Next.js UI, Server Actions, route handlers, and the assistant stream over SSE
  - `realtime`: `tsx src/realtime/server.ts`, a WebSocket server with Redis pub/sub fan-out
  - `worker`: `tsx src/worker/scan.ts`, a deadline scan on a timer
- **NGINX** fronts everything. Browsers reach every route over HTTPS: `/` goes to `web` and `/ws` to `realtime`. Nothing browser-facing may address a container hostname directly.
- **Published interfaces** are in plan §5: `lib/auth/session.ts` (`requireUser`), `lib/auth/policy.ts` (`can`/`assertCan`, default-deny), `contracts/events.ts`, `lib/storage/index.ts`, `lib/ai/extract.ts`, `lib/ai/assistant.ts` and `lib/documents/status.ts`. Code against these signatures. Changing one needs a whole-team decision.
- **Directory ownership** is in plan §4. Each directory has one owner, who reviews edits there.
- `src/contracts/` holds only types and pure functions. It is imported by all three processes and imports nothing back.

### Rules the plan treats as review failures

- Document status (`VALID · EXPIRING_SOON · EXPIRED · ACTION_REQUIRED`) is **derived at read time** by `deriveStatus()`. It is never stored.
- Deadline notifications rely on `@@unique([documentId, kind])` for idempotency. Double votes and double joins are blocked by unique constraints. Concurrent document edits use `Document.version` for optimistic concurrency, and a conflict returns a 409.
- Each form has **one Zod schema module**, imported by both the client component and the server action. For documents, that module is `lib/documents/schemas.ts`.
- Uploads: max 10 MB. The allowed MIME types are jpeg, png, webp and pdf, verified server-side by **magic bytes**. Files are served only through the authorised route `GET /api/documents/[id]/file`, never through presigned URLs.
- Document content never reaches the community layer. The assistant builds its context server-side, only after `assertCan(ctx, 'document:read', doc)`.
- Every user-visible string goes through `next-intl`, with `fr` as the default plus `en` and `es`. Hardcoded strings fail review. Assistant error messages are i18n keys.
- Any price or market comparison from the assistant is labelled indicative, states its source and includes a not-financial-advice disclaimer.
- Every Prisma model has `createdAt` and `updatedAt`. Timestamps are stored in UTC and rendered in `Europe/Paris`.
- Graded requirements: no warnings or errors in the Chrome console on any route; a responsive, keyboard-navigable layout at 375, 768 and 1440 px; accessible Privacy Policy and Terms pages.
- AI tests run against committed fixtures, never live API calls. The planned model is `claude-opus-5` through `@anthropic-ai/sdk`: `messages.parse()` with Zod for extraction, and streaming for the assistant.

## UI conventions

- Shared primitives live in `src/components/ui/`: Button, Card, Badge, Input, Dialog, Table and EmptyState. They are plain function components with variant or tone maps. Class names are joined with template strings; there is no `clsx` or `cva`.
- Styling is Tailwind 4 on the zinc palette, with explicit `dark:` variants on each element.
- App-level components (`Nav`, `MobileMenu`, `LocaleSwitcher`) live in `src/components/`.
- **When you add a primitive, also add it to the gallery at `/[locale]/dev/ui`** (`src/app/[locale]/dev/ui/page.tsx`). The existing UI commits all follow this pattern.
- Pages that query Prisma at request time set `export const dynamic = "force-dynamic"`.

## Workflow

- No direct pushes to `main`. Work goes on `feat/*` or `chore/*` branches and merges by PR with one approving review. Plan §0 requires Conventional Commits (`feat(auth): …`) and zero lint warnings.
- `.env` is git-ignored. `.env.example` must list every key the code uses. Uncomment a planned key in the same PR that introduces its service.
- **The commit history does not actually follow Conventional Commits** (`added nginx infra config`, `Add Table UI`). The plan §0 rule stands; the existing history is not a model to copy.
- **`docs/`, `handoff/`, `MEETING_DISCUSSION.md` and `CLAUDE.md` are committed and pushed with the work they describe**, on the same branch and in the same PR (since 2026-10-05). History: `15b75ff` git-ignored them (2026-09-22), `f07b382` committed them (2026-09-29, PR #13), and from 2026-10-02 to 2026-10-05 their edits stayed out of feature PRs and went to `main` in batched `chore/docs` PRs, which is why older worklog entries mention `chore/docs`. Check `git status` and stage by path before committing: `.env` is git-ignored, but a real secret pasted into `.env.example` is not.
- **Progress lives in `handoff/WORKLOG.md`.** Read it at the start of a session and update it after each commit or phase. The roadmap ticks a phase's checkboxes once it is merged (phases 0–3 so far).
- `npm run lint` reports 0 errors and 0 warnings since `chore/review-fixes` (2026-10-09). Keep it at zero, as the plan requires.
- **Rasiol's roadmap for all four of his modules is [`docs/plans/2026-09-21-rasiol-modules-roadmap.md`](docs/plans/2026-09-21-rasiol-modules-roadmap.md)** (2026-09-21). It supersedes `docs/plans/2026-09-17-c1-auth-contract-and-session-core.md`, which was lost because `docs/` was untracked. Twelve phases (0–11) with entry gates: tooling → session core → login/guard → `can()` + audit → admin surface → channels → threads/votes → moderation → OAuth Google → OAuth GitHub → TOTP → step-up 2FA. Phases 0–4 have full TDD steps; 5–11 are specified at task level and each is expanded into its own `docs/plans/` doc when its gate opens.
  - Phases 0–3 are done and merged: phase 1 in PR #10 (`0dcdb38`, 2026-09-25), phase 2 tasks 2.1–2.4 in PR #13 (`dbefd7d`, 2026-09-30), phase 3 in PR #18 (`e11c60b`, 2026-10-05). **Task 2.5 (WS ticket) is built and in review** (PR #22, `feat/auth-ws-ticket`); Alexandre still has to call `verifyTicket()` in his realtime server. **Phase 4** (admin surface) is built on `feat/admin-surface`: tasks 4.1–4.2 in `58508e1`, 4.3 in `c920519`, the final-review fixes (double click / stale page, role guard) uncommitted, no PR yet. Phase 5's gate is open too (phase 3 and `feat/channels` are both merged). See `handoff/WORKLOG.md`. A layout-level `requireUser()` does not re-run on client navigation, so pages that read private data call `requireUser()` too (Next `guides/authentication.md`).
  - **The roadmap's own phases 0–9 need no migration** — the schema already has `Session`, `OAuthAccount`, `AuditLog`, the `User` auth columns, and the whole community layer. It plans one: phase 10 (2FA columns). Phase 7's moderation columns are Amir's (E11). `prisma/` is Amir's directory, so coordinate phase 10's migration with him.
  - Decisions recorded there that affect other people's code: `MODERATOR` is **not** added to `GlobalRole` (moderator is a `ChannelRole`, scoped to one channel); the admin route renders its 403 from `layout.tsx` rather than throwing, because `error.tsx` does not wrap the `layout.tsx` in its own segment; `SessionContext` carries a `memberships` array (additive to plan §5) because `can()` is synchronous and cannot query; `Resource.channelId` is `number`, not `string`, because `Channel.id` is `Int`; **no auth in `middleware.ts`/`proxy.ts`** (the file now exists, for next-intl locale routing only) — the boundary is `requireUser()` in the segment layout plus `requireUser()` + `assertCan()` inside every Server Action; CSRF is Next.js's built-in Server Action Origin/Host check, not a hand-rolled token.
  - The roadmap says routes are built flat with English strings and moved under `app/[locale]/` later. **That no longer applies:** `next-intl` shipped in PR #12 (2026-09-27). New pages go straight into `src/app/[locale]/` (e.g. `/[locale]/login`, `/[locale]/admin/users`) with strings in `messages/*.json`.
  - Ownership of E9–E11 (channels, threads/votes, moderation) is **Amir's** (`PROJECT_PLAN.md` §6/§7). E9 merged in PR #9 (2026-10-05); E10 votes and E11 hide/mute are not started. The roadmap's phases 5–7 now cover only Rasiol's share: `assertCan()` in his actions (phase 5's mapping table), channel roles (C14b) and the moderation sign-off. Still to do: record the decision in `MEETING_DISCUSSION.md`.
  - Git authors: `khelifi` / `amkhelif` = Amir, `sku` = Alexandre, `Reaven23` = Adrien, `risufaj` = Rasiol.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
