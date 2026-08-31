# MesPapiers — 5-Week Implementation Plan

> **For implementers:** tasks below are sized for one human developer-day and each
> carries a **Done when** acceptance check. When a task is handed to an agentic
> worker instead, expand it first into a per-task TDD plan under
> `docs/plans/YYYY-MM-DD-<task-id>.md` — failing test, run it, minimal
> implementation, run it, commit. Never hand a WBS row straight to an agent.

**Goal:** Ship MesPapiers — a household document engine that turns photographed French
paperwork into tracked, deadline-aware objects on a shared real-time dashboard — as a
19-point, 4-person, 5-week graded project.

**Architecture:** A containerised TypeScript monorepo behind an NGINX TLS proxy. Next.js
(App Router) owns UI and HTTP backend; a separate Node WebSocket service fans household
events out via Redis pub/sub; a separate worker container runs the notification cron.
PostgreSQL via Prisma is the single source of truth, MinIO holds the files, and every
document status is derived at read time rather than stored.

**Tech Stack:** TypeScript · Next.js 15 (App Router) · Tailwind · Prisma + PostgreSQL 17 ·
Redis 7 · `ws` · BullMQ · MinIO · NGINX · Docker Compose · `next-intl` · Recharts ·
Anthropic `claude-opus-5` · Vitest + Playwright · GitHub Actions

**Specs:** [`mespapiers_project_vision.md`](mespapiers_project_vision.md) (product) ·
[`subject_requirements.md`](subject_requirements.md) (graded requirements). This plan argues
from both; executors read all three.

---

## Context

The team of 4 has a project vision and a graded subject, but no repository, no schedule, and
no allocation. The vision specifies 19 module points across 6 major and 7 minor modules — an
aggressive scope for 5 weeks with two junior developers. This plan converts the vision into a
dependency-ordered, person-by-person schedule with a hard feature freeze, so that the graded
requirements (multi-user concurrency, HTTPS, Docker, even commit distribution) are satisfied
by construction rather than discovered missing in Week 5.

The organising principle: **Week 1 is contracts, Week 2 is one working vertical slice,
Weeks 3–4 are parallel build-out, Week 5 is stabilisation.** Nothing is scheduled that
depends on an interface that hasn't already been published.

---

## 0. Global Constraints

Project-wide rules. Every task's definition of done implicitly includes this section.

**Versions and tooling**

- Node **22 LTS**, TypeScript **5.x** with `strict: true` and `noUncheckedIndexedAccess`.
- Next.js **15** App Router · PostgreSQL **17** · Redis **7** · NGINX **1.27** · MinIO latest.
- Package manager **pnpm**, one lockfile committed at the repo root.

**Product rules copied verbatim from the specs**

- Locales: **`fr` (default), `en`, `es`**. Every user-visible string resolves through
  `next-intl`; a hardcoded string fails review.
- Hard-deadline alerts fire at exactly **90, 60 and 30 days** before `targetDate`.
- Soft-renewal nudge fires at exactly **60 days** before the contract anniversary. (The
  vision says "30 to 60 days"; the plan pins 60 so the scheduler and the tests agree.)
- Document statuses are exactly **VALID · EXPIRING_SOON · EXPIRED · ACTION_REQUIRED**,
  derived by `deriveStatus()` (§5) — never stored.
- Privacy Policy and Terms of Service pages must exist, be reachable without logging in, and
  carry real content in all three locales.

**Security and correctness**

- Everything a browser touches is **HTTPS through NGINX**. No page, asset, file download or
  WebSocket may address a container hostname directly. Backend-internal traffic may be plain.
- Every form is validated by **one Zod schema module imported by both the client component
  and the server action**. Two schemas that "match" is a defect, not an implementation.
- Uploads: max **10 MB**, MIME allow-list `image/jpeg`, `image/png`, `image/webp`,
  `application/pdf`, verified by **magic bytes** server-side, never by the declared type.
- Secrets live only in `.env` (git-ignored). `.env.example` lists every key with a dummy
  value and is checked by `pnpm check:env` in CI.
- Timestamps stored in UTC, rendered in `Europe/Paris`.
- Every Prisma model carries `createdAt` and `updatedAt`.

**Process**

- Conventional Commits. No direct pushes to `main`. Every member merges **≥3 PRs per week**.
- Zero warnings and zero errors in the console of the latest stable Chrome, on every route.
- Responsive and keyboard-navigable at **375 / 768 / 1440**.

---

## 1. Project Overview

MesPapiers is a household document engine for people navigating French administrative
paperwork. Users photograph a document; an AI vision model extracts its type, issuing
authority and expiry date, turning a flat image into a structured, tracked object linked to
a specific family member. A shared real-time dashboard then shows the whole household's
administrative health and proactively warns before hard legal deadlines (passports, *titres
de séjour*, *contrôle technique*) and soft financial ones (auto-renewing insurance contracts).

**Team and roles** (per the subject's role requirement):

| Member | Roles | Focus | Experience |
|---|---|---|---|
| Adrien | Product Owner · Technical Lead | Infrastructure, CI, AI extraction, review | 3 years |
| Rasiol | Project Manager · Architect | Auth, security, permissions | 1 year |
| Alexandre | Developer | Real-time, notifications, i18n, UI shell | — |
| Amir | Developer | Database, storage, analytics, GDPR | — |

---

## 2. Confirmed Decisions

| Decision | Choice | Consequence |
|---|---|---|
| Deployment | Local Docker Compose only | NGINX + locally-trusted cert. CI tests and builds images; it does not deploy. |
| File storage | MinIO container (S3-compatible) | Internal network only. Files reach the browser through an authorised route handler — see below. |
| Languages | FR / EN / ES via `next-intl` | No RTL work. Build with Tailwind logical properties anyway so Arabic stays cheap later. |
| Auth | Own the session table (Lucia pattern) | See the correction below — this is hand-rolled, not a library install. |
| AI provider | Anthropic `claude-opus-5` via `@anthropic-ai/sdk` | Structured extraction with `messages.parse()` + Zod. |
| Locale routing | `app/[locale]/...` from Week 1 | Every route is built inside the locale segment from day one. Retrofitting it in Week 4 would mean touching every page during the freeze. |
| File serving | Authorised route handler, **not** presigned URLs | See below. |

### Correction on the auth choice

The option was described as a "lightweight session library." As of August 2026 that library
does not exist:

- **Lucia was deprecated in March 2025.** It is now an educational resource — a single-file
  reference implementation (`auth_session.ts`) plus the [Auth Book](https://auth.pilcrowonpaper.com).
- **Arctic (the OAuth client library) was deprecated in July 2026**, along with most Oslo
  packages. Replacement example code lives in the Arctic repo's `/code` directory.

The choice is still sound — a 42 evaluation rewards being able to defend your own security —
but it means sessions, the Google/GitHub OAuth flows, and TOTP are all **written by hand** by
the team's least experienced developer, on the critical path for everyone else. Sections 9
and 10 mitigate this specifically. Concrete maintained primitives to use:

| Need | Package | Notes |
|---|---|---|
| Password hashing | `@node-rs/argon2` | Argon2id by default. |
| Session tokens | `node:crypto` — none needed | `getRandomValues` → base32; store only the SHA-256 hash. |
| TOTP | `otpauth` | Enrollment URI + QR, drift window, recovery codes. |
| OAuth 2.0 client | Hand-rolled `fetch` + PKCE | ~80 lines per provider; use Arctic's `/code` examples as reference. Do **not** reach for `ts-oauth2-server` — that builds an authorization *server*, the opposite side of the flow. |
| JWT (WS tickets only) | `jose` | `jsonwebtoken` is legacy. |

### Correction on file serving

The obvious S3 pattern — hand the browser a presigned GET URL — **does not work in this
topology and would fail two graded requirements.** MinIO sits on the internal network with no
host port in the base compose file, so a presigned URL points at `http://minio:9000/...`,
which Chrome cannot resolve and which is not HTTPS. Even proxying MinIO through NGINX so the
signature matches (`MINIO_SERVER_URL=https://mespapiers.local/files`) hands out a URL that
bypasses `can()` for its whole lifetime — awkward when RBAC is a module being graded.

**Decision:** every byte reaches the browser through
`GET /api/documents/[id]/file` → `requireUser()` → `assertCan(ctx, 'document:read', doc)` →
`getObjectStream(doc.storageKey)`, streamed back with `Content-Disposition` and
`Cache-Control: private, no-store`. Avatars and GDPR export ZIPs use the same pattern.
Consequently the storage adapter exposes `getObjectStream`, **not** `presignedGet`.

---

## 3. Technical Architecture & Infrastructure

### Container topology (`docker-compose.yml`)

```text
                        [ Chrome ]
                            │  https://mespapiers.local
                    ┌───────▼────────┐
                    │     nginx      │  TLS termination, / → web, /ws → realtime
                    └───┬────────┬───┘        (edge network)
            ┌───────────┘        └────────────┐
     ┌──────▼──────┐                   ┌──────▼───────┐
     │     web     │                   │   realtime   │
     │  Next.js    │                   │  Node + ws   │
     └──────┬──────┘                   └──────┬───────┘
            │            ┌──────────┐         │
            ├────────────┤  worker  ├─────────┤   cron: notification scan
            │            └────┬─────┘         │
   ─────────┴─────────────────┴───────────────┴────────  (internal network)
       │                  │                    │
 ┌─────▼─────┐      ┌─────▼─────┐        ┌─────▼─────┐      ┌─────────┐
 │ postgres  │      │   redis   │        │   minio   │      │ mailpit │
 └───────────┘      └───────────┘        └───────────┘      └─────────┘
```

Eight services. Two networks — `postgres`, `redis`, `minio` and `mailpit` are **not**
published to the host in the base compose file; a `docker-compose.override.yml` exposes them
for local development only. This directly satisfies the subject's rule that internal backend
traffic may be unencrypted while anything reaching a browser must be HTTPS.

Compose authorship is split so two people aren't editing the same file on day one: **Adrien
owns the app services** (`nginx`, `web`, `realtime`, `worker`) and the network/volume
definitions (A2); **Amir owns the data services** (`postgres`, `redis`, `minio`, `mailpit`)
and MinIO bucket initialisation (E3).

**Certificate:** use `mkcert` to install a local CA and issue a cert covering **both**
`mespapiers.local` and `localhost`. A raw self-signed cert makes Chrome throw interstitials
and console noise, and the subject explicitly grades "no warnings or errors in the browser
console." `mespapiers.local` needs an `/etc/hosts` entry — see R11.

**`worker`** is a separate container from `web` on purpose: Next.js containers may be
restarted or scaled, and a cron loop inside one would double-fire notifications.

### Database architecture

PostgreSQL via Prisma. Core entities and the relations that matter:

| Model | Key fields | Purpose |
|---|---|---|
| `Household` | `id`, `name` | Tenancy boundary. Every query scopes to it. |
| `User` | `id`, `email`, `passwordHash?`, `displayName`, `avatarKey?`, `locale`, `totpSecret?`, `totpEnabled` | A login. `passwordHash` is nullable for OAuth-only accounts. `avatarKey` is a MinIO key, not a URL. |
| `HouseholdMember` | `id`, `householdId`, `displayName`, `dateOfBirth`, `userId?` | A **person whose documents are tracked**. Nullable `userId` — a child has documents but no login. |
| `HouseholdMembership` | `userId`, `householdId`, `role` | Explicit RBAC join table. Makes the permissions module legible at evaluation. |
| `HouseholdInvite` | `id`, `householdId`, `email`, `role`, `tokenHash`, `expiresAt`, `acceptedAt` | Email invitation. Hash stored, never the raw token. |
| `Session` | `id` (SHA-256 of token), `userId`, `expiresAt`, `twoFactorVerified`, `ipAddress`, `userAgent` | Opaque tokens; the raw token is never stored. |
| `OAuthAccount` | `userId`, `provider`, `providerUserId` | `@@unique([provider, providerUserId])` |
| `Document` | `householdId`, `memberId`, `uploaderId`, `category`, `deadlineType`, `title`, `issuingAuthority`, `issueDate`, `targetDate`, `storageKey`, `mimeType`, `sizeBytes`, `checksum`, `extractionStatus`, `version` | The central object. |
| `DocumentExtraction` | `documentId`, `model`, `rawJson`, `confidence`, `inputTokens`, `outputTokens` | Audit trail of every AI call — evidence for the LLM module and a debugging lifeline. |
| `Notification` | `userId`, `documentId`, `kind`, `scheduledFor`, `sentAt`, `readAt` | `@@unique([documentId, kind])` |
| `AuditLog` | `householdId`, `actorUserId`, `action`, `targetType`, `targetId`, `metadata` | Evidence for both the permissions and GDPR modules. |
| `DataRequest` | `userId`, `type`, `status`, `confirmedAt`, `downloadKey` | GDPR export / deletion with email confirmation. |

Enums: `DocumentCategory` (IDENTITY, VEHICLE, HOUSING, HEALTH, INSURANCE, EMPLOYMENT,
EDUCATION, TAX, OTHER) · `DeadlineType` (HARD, SOFT) · `Role` (OWNER, ADMIN, MEMBER) ·
`NotificationKind` (T90, T60, T30, ANNUAL_NUDGE) · `ExtractionStatus` (PENDING, NEEDS_REVIEW,
CONFIRMED, FAILED).

Three schema rules the team should not break:

1. **Do not store document status.** `VALID / EXPIRING_SOON / EXPIRED / ACTION_REQUIRED` is
   derived from `targetDate` and `extractionStatus` at read time by one shared helper (§5). A
   stored status column will silently drift out of sync with the cron job and the UI will
   contradict itself.
2. **`@@unique([documentId, kind])` on `Notification` is the idempotency guarantee.** The
   scheduler is allowed to be at-least-once; the database makes it effectively-once. This is
   how the "no data corruption or race conditions" requirement gets satisfied at the storage
   layer rather than by hoping.
3. **`Document.version` for optimistic concurrency.** Two family members editing the same
   document is the exact concurrent-write case the subject asks about. Every update carries
   the version it read; a mismatch is a 409, not a silent overwrite.

Indexes: `Document(householdId, targetDate)`, `Document(memberId)`, `Document(checksum)`,
`Notification(scheduledFor, sentAt)`, `Session(userId)`, `HouseholdInvite(tokenHash)`.

### CI/CD (GitHub Actions)

- **`ci.yml`** on every PR: `tsc --noEmit` → ESLint → `prisma validate` + `prisma migrate diff`
  drift check → `pnpm check:env` → `pnpm i18n:check` → Vitest unit tests → `next build` →
  `docker compose build`.
- **`e2e.yml`** nightly + on `main`: `docker compose up -d`, Playwright smoke suite
  (signup → login → upload → extract → dashboard), upload traces on failure.
- **Branch protection on `main`:** no direct pushes, one approving review, CI green.
  Adrien reviews everyone; Rasiol reviews Adrien.
- AI extraction tests run against **committed fixtures**, never live API calls.

---

## 4. Repository & File Structure

Decided before any code so that four people building in parallel don't collide. **One owner
per directory**; edits outside your directories go through that directory's owner in review.

```text
mespapiers/
├─ docker-compose.yml                 # app services, networks, volumes   [Adrien]
├─ docker-compose.override.yml        # host ports for local dev only     [Amir]
├─ .env.example                       # every key, dummy values           [Adrien]
├─ infra/nginx/{nginx.conf,certs/}                                       # [Adrien]
├─ docs/{architecture.md,demo-script.md,adr/NNNN-*.md,plans/}            # [Adrien]
├─ packages/
│  └─ contracts/src/events.ts         # WS/Redis event union, shared by 3 apps [Alexandre]
├─ apps/
│  ├─ web/                            # Next.js — UI + HTTP backend
│  │  ├─ prisma/{schema.prisma,migrations/,seed.ts}                      # [Amir]
│  │  ├─ messages/{fr.json,en.json,es.json}                              # [Alexandre]
│  │  └─ src/
│  │     ├─ app/[locale]/(auth)/{login,signup,invite}/                   # [Rasiol]
│  │     ├─ app/[locale]/(app)/{dashboard,documents,members,settings}/   # owner per feature
│  │     ├─ app/[locale]/(public)/{privacy,terms}/                       # [Amir]
│  │     ├─ app/api/                  # route handlers (file, ws-ticket, oauth callbacks)
│  │     ├─ components/ui/            # shared primitives — the design system [Alexandre]
│  │     ├─ components/{documents,analytics,notifications}/
│  │     ├─ lib/auth/{session.ts,policy.ts,totp.ts,oauth/}               # [Rasiol]
│  │     ├─ lib/ai/{client.ts,extract.ts,prompt.ts}                      # [Adrien]
│  │     ├─ lib/storage/index.ts                                         # [Amir]
│  │     ├─ lib/documents/{queries.ts,status.ts,schemas.ts}              # [Amir]
│  │     └─ lib/events/publish.ts     # thin wrapper over Redis publish
│  ├─ realtime/src/{server.ts,registry.ts,subscribe.ts,presence.ts}      # [Alexandre]
│  └─ worker/src/{index.ts,scan.ts,rules.ts,mailer.ts}                   # [Alexandre]
└─ tests/{e2e/, fixtures/documents/}                                     # [Adrien]
```

Two structural rules:

- **`lib/documents/schemas.ts` holds the Zod schemas imported by both the form and the server
  action.** This is the file that makes "validated on both sides" true rather than claimed.
- **`packages/contracts` is the only code shared across apps.** If web, realtime and worker
  all need a type, it lives there. Nothing else crosses an app boundary.

---

## 5. Published Interfaces

These signatures are committed in **Week 1, before their implementations exist**, so that
everyone codes against a type instead of waiting. Changing one after publication is a
whole-team decision announced at standup.

`Role`, `Document`, `DocumentCategory`, `DeadlineType` and `ExtractionStatus` are imported
from `@prisma/client` (generated by E1). `Locale` is `'fr' | 'en' | 'es'`, exported from
`apps/web/src/i18n/config.ts` (D10). No signature below references a type defined nowhere.

### Auth — `apps/web/src/lib/auth/session.ts` (Rasiol, due W1 D1)

```ts
export type SessionUser = {
  id: string; email: string; displayName: string;
  avatarKey: string | null; locale: Locale; totpEnabled: boolean;
};

export type SessionContext = {
  session: { id: string; expiresAt: Date; twoFactorVerified: boolean };
  user: SessionUser;
  householdId: string;
  role: Role;                       // OWNER | ADMIN | MEMBER
};

export async function validateSessionToken(token: string): Promise<SessionContext | null>;
export async function getCurrentUser(): Promise<SessionContext | null>;  // reads the cookie
export async function requireUser(): Promise<SessionContext>;            // redirects if absent
export async function createSession(userId: string, householdId: string):
  Promise<{ token: string; expiresAt: Date }>;
export async function invalidateSession(sessionId: string): Promise<void>;
```

With `AUTH_STUB=1`, `getCurrentUser()` and `validateSessionToken()` return a seeded
`SessionContext` so nobody idles waiting for C1. The stub is deleted in W2 and CI fails if
`AUTH_STUB` appears outside `.env.example`.

### Permissions — `apps/web/src/lib/auth/policy.ts` (Rasiol, signature due W1 D1)

```ts
export type Action =
  | 'document:read' | 'document:create' | 'document:update' | 'document:delete'
  | 'member:read'   | 'member:create'   | 'member:update'   | 'member:delete'
  | 'household:invite' | 'household:manageRoles'
  | 'analytics:read' | 'gdpr:export' | 'gdpr:delete';

export type Resource = {
  householdId: string;
  ownerUserId?: string | null;   // uploader, for own-document rules
  memberId?: string | null;      // subject of the document
};

export function can(ctx: SessionContext, action: Action, resource: Resource): boolean;
export function assertCan(ctx: SessionContext, action: Action, resource: Resource): void;
```

`can()` is **default-deny**: an unknown action or a `householdId` mismatch returns `false`
before any role logic runs.

### Realtime events — `packages/contracts/src/events.ts` (Alexandre, due W1 D2)

```ts
export type HouseholdEvent =
  | { type: 'document.created';     householdId: string; documentId: string; memberId: string; actorUserId: string; at: string }
  | { type: 'document.updated';     householdId: string; documentId: string; version: number;  actorUserId: string; at: string }
  | { type: 'document.deleted';     householdId: string; documentId: string; actorUserId: string; at: string }
  | { type: 'extraction.completed'; householdId: string; documentId: string; status: ExtractionStatus; at: string }
  | { type: 'notification.created'; householdId: string; userId: string; notificationId: string; at: string }
  | { type: 'member.changed';       householdId: string; memberId: string; at: string }
  | { type: 'presence.changed';     householdId: string; userId: string; online: boolean; at: string };

export const channelFor = (householdId: string) => `household:${householdId}`;
export async function publish(event: HouseholdEvent): Promise<void>;
```

`householdId` is present on every variant so the realtime server can route without a database
round-trip — but it is always resolved server-side from the session, never from the client.

### Storage — `apps/web/src/lib/storage/index.ts` (Amir, due W1 D3)

```ts
export type StoredObject = { key: string; sizeBytes: number; checksum: string; mimeType: string };

export function objectKey(householdId: string, documentId: string, filename: string): string;
export async function putObject(input: {
  key: string; body: Buffer; mimeType: string;
}): Promise<StoredObject>;
export async function getObjectStream(key: string): Promise<ReadableStream<Uint8Array>>;
export async function deleteObject(key: string): Promise<void>;
```

No `presignedGet` — see the file-serving decision in §2.

### Extraction — `apps/web/src/lib/ai/extract.ts` (Adrien, due W2 D1)

```ts
export const ExtractionSchema = z.object({
  documentType:     z.string(),
  category:         z.nativeEnum(DocumentCategory),
  deadlineType:     z.nativeEnum(DeadlineType),
  issuingAuthority: z.string().nullable(),
  holderName:       z.string().nullable(),
  issueDate:        z.string().date().nullable(),
  targetDate:       z.string().date().nullable(),
  confidence:       z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export async function extractDocument(input: {
  buffer: Buffer; mimeType: string; documentId: string;
}): Promise<{
  extraction: Extraction | null;
  status: ExtractionStatus;
  usage: { inputTokens: number; outputTokens: number };
}>;
```

### Status derivation — `apps/web/src/lib/documents/status.ts` (Amir, due W1 D3)

The one helper every surface calls. The vision names four statuses but never says what
produces `ACTION_REQUIRED`; this pins it.

```ts
export type DocumentStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'ACTION_REQUIRED';

export function deriveStatus(
  doc: Pick<Document, 'targetDate' | 'deadlineType' | 'extractionStatus'>,
  now: Date = new Date(),
): DocumentStatus;
```

Rules, in order:

1. `extractionStatus` is not `CONFIRMED`, **or** `targetDate` is null → `ACTION_REQUIRED`.
   A document the AI could not read is not "valid" — it is waiting on a human.
2. `deadlineType === 'HARD'`: `targetDate < now` → `EXPIRED`; within 90 days →
   `EXPIRING_SOON`; otherwise `VALID`.
3. `deadlineType === 'SOFT'`: within 60 days of the next anniversary of `targetDate` →
   `EXPIRING_SOON`; otherwise `VALID`. **A soft renewal never becomes `EXPIRED`** — the risk
   is overpayment, not loss of service.

---

## 6. Module Ownership — 19 Points

| Module | Type | Pts | Owner |
|---|---|---|---|
| Framework for frontend and backend (Next.js) | Major | 2 | Adrien |
| Complete LLM system interface (AI vision OCR) | Major | 2 | Adrien |
| Standard user management and authentication | Major | 2 | Rasiol |
| Advanced permissions system (household RBAC) | Major | 2 | Rasiol |
| Remote authentication with OAuth 2.0 | Minor | 1 | Rasiol |
| Complete 2FA system (TOTP) | Minor | 1 | Rasiol |
| Real-time features using WebSockets | Major | 2 | Alexandre |
| Complete notification system | Minor | 1 | Alexandre |
| Multiple languages (FR/EN/ES) | Minor | 1 | Alexandre |
| Advanced analytics dashboard | Major | 2 | Amir |
| Use an ORM for the database (Prisma) | Minor | 1 | Amir |
| File upload and management system | Minor | 1 | Amir |
| GDPR compliance features | Minor | 1 | Amir |
| **Total** | | **19** | 6 major + 7 minor |

**On the balance:** Rasiol carries the most module points (6) but writes almost no feature
UI. Adrien carries the fewest (4) but owns the entire infrastructure, CI, code review load,
and PO validation — none of which scores points but all of which is required. Alexandre (4)
and Amir (5) carry the heaviest UI surface. This is deliberate and roughly even in hours.

**Module ownership is not exclusive authorship.** D14 (profile & settings UI) is built by
Alexandre but counts towards Rasiol's user-management module; Rasiol supplies the server
actions. Say this out loud at evaluation rather than letting it look like a gap.

---

## 7. Work Breakdown Structure

Every task carries a **Done when** — the observable check that closes it. A task without a
check is a task nobody can review.

### Domain A — Architecture & Infrastructure (Adrien)

| # | Task | Est. | Done when |
|---|---|---|---|
| A1 | Repo init, pnpm workspace, Next.js App Router + Tailwind + strict `tsconfig`, ESLint/Prettier | 0.5d | `pnpm i && pnpm build` succeeds from a clean clone; `tsc --noEmit` and ESLint pass with zero warnings |
| A2 | `docker-compose.yml` — app services (nginx, web, realtime, worker), two networks, healthchecks, named volumes | 1d | `docker compose up` brings all four to healthy; `docker compose ps` shows every healthcheck passing |
| A3 | NGINX reverse proxy, `mkcert` TLS for `mespapiers.local` + `localhost`, WS upgrade routing, security headers | 1d | Chrome shows a padlock with no interstitial; `/ws` returns 101; `curl -I` shows HSTS, X-Content-Type-Options, Referrer-Policy, CSP |
| A4 | `.env.example` + secret handling, `pnpm check:env`, `.gitignore` audit | 0.5d | `git log --all -- .env` is empty; `check:env` fails CI when a key used in code is missing from the example |
| A5 | GitHub Actions `ci.yml`, branch protection, PR template | 1d | a PR containing a deliberate type error is blocked and cannot be merged |
| A6 | Playwright + `e2e.yml` against live compose | 1d | the signup→upload→extract→dashboard spec runs against compose in CI and uploads a trace on failure |
| A7 | Performance pass: N+1 audit, Next caching, image optimisation | 1d | Prisma query logging shows no per-row query in the dashboard path; LCP under 2.5s locally |
| A8 | Image slimming (standalone output, multi-stage builds) | 0.5d | `web` image under 400 MB; cold `docker compose build` under 5 min |
| A9 | README, architecture docs, ADR log, demo script | 1d | a teammate reaches a running app on a clean machine following the README alone; the ADR log has one entry per row of §2 |

### Domain B — AI Extraction (Adrien)

| # | Task | Est. | Done when |
|---|---|---|---|
| B1 | Fixture set: 12–15 redacted real French documents, 2–3 per member, collected W1 | 0.5d | `tests/fixtures/documents/` holds ≥12 files, each with a hand-written `expected.json` ground truth |
| B2 | Anthropic SDK wiring, `claude-opus-5`, image + PDF content blocks | 0.5d | a fixture image and a fixture PDF both round-trip and their raw responses are logged |
| B3 | Zod extraction schema + `messages.parse()` structured output | 1d | `extractDocument()` returns a value typed `Extraction`; a malformed model reply is rejected by Zod and never persisted |
| B4 | Prompt engineering + fixture-based accuracy eval harness | 1.5d | `pnpm eval:extraction` prints per-field accuracy; ≥80% exact match on `documentType` and `targetDate` across the fixture set |
| B5 | Error handling: refusals, low confidence, timeouts, malformed pages | 1d | refusal, timeout, oversize, empty PDF and a garbage image each map to a distinct `ExtractionStatus` and a translated user message, covered by unit tests with mocked responses |
| B6 | `DocumentExtraction` audit persistence + token accounting | 0.5d | every call writes a row with token counts; one query reports spend for the month |
| B7 | Checksum-based caching + per-user daily rate cap | 0.5d | re-uploading a byte-identical file makes zero API calls (asserted with a spy); the 21st upload in 24h by one user is rejected |
| B8 | Manual-correction UI for low-confidence extractions | 1.5d | an extraction below 0.7 confidence lands on a review screen where every field is editable; confirming flips `extractionStatus` to `CONFIRMED` and the derived status follows |

### Domain C — Auth, Security & Permissions (Rasiol)

| # | Task | Est. | Done when |
|---|---|---|---|
| C1 | Session core: Argon2id, opaque token, SHA-256 storage, `validateSessionToken()` | 2d | unit tests cover creation, hash lookup, expiry, sliding renewal, invalidation; a test asserts the raw token appears in no column |
| C2 | Signup / login / logout server actions + shared Zod schemas | 1d | the flow works end to end and a test proves the form and the action import the *same* schema module |
| C3 | Route middleware, `getCurrentUser()`, protected layout, `AUTH_STUB` | 0.5d | an unauthenticated request to any `(app)` route redirects to `/login`; `AUTH_STUB=1` returns the seeded context |
| C4 | RBAC: `can(ctx, action, resource)` policy module, default-deny | 1.5d | a truth-table test covers every Action × Role; an unknown action and a foreign `householdId` both return `false` |
| C5 | Apply ownership guards to every server action, query and route handler | 1d | a scripted MEMBER request for another member's document returns 403 from the server action, the list query and `/api/documents/[id]/file` |
| C6 | `AuditLog` writes on all privileged actions | 0.5d | every action in the `Action` union that mutates writes a row; a test asserts the count increments per call |
| C7 | OAuth 2.0 — Google, authorization-code + PKCE, hand-rolled | 1.5d | sign-in completes with `state` and `code_verifier` both single-use and expiring; a replayed callback is rejected |
| C8 | OAuth 2.0 — GitHub + account-linking edge cases | 1d | signing in with GitHub on an email that already has a password account links to the same `User`; tested in both orders |
| C9 | TOTP 2FA: enrollment QR, verification, recovery codes | 1.5d | the QR scans in a real authenticator; a code from ±1 window verifies; each of 10 recovery codes works exactly once |
| C10 | Step-up 2FA on sensitive actions (delete, export) | 0.5d | document delete and GDPR export demand a fresh TOTP when `twoFactorVerified` is stale |
| C11 | Rate limiting on auth endpoints, CSRF, session rotation | 1d | 6 failed logins in 15 min lock the endpoint; the session id rotates on login and on privilege change; a cross-site POST without the token is rejected |
| C12 | WS ticket endpoint (short-lived, single-use) for Alexandre | 0.5d | a ticket is single-use, expires in 60s, is bound to the user, and a replay is rejected |
| C13 | Security review: OWASP pass, secrets audit, dependency audit | 1d | the OWASP Top-10 checklist is filled in with per-item evidence; `pnpm audit` reports no high/critical; `gitleaks` finds nothing in history |
| **C14** | **Household creation on signup, email invite, accept, role assignment UI** | **1.5d** | a second browser accepts an emailed invite, appears as MEMBER, and an OWNER can promote/demote them — the two-browser demo runs on real data, not seeds |

### Domain D — Real-Time, Notifications, i18n & Shell (Alexandre)

| # | Task | Est. | Done when |
|---|---|---|---|
| **D0** | **App shell: `app/[locale]` layout, nav, `components/ui` primitives (Button, Card, Badge, Dialog, Input, Table, EmptyState), Tailwind tokens, a11y baseline** | **1d** | every primitive renders in a `/dev/ui` gallery at 375/768/1440, is keyboard-reachable with a visible focus ring, and axe reports zero violations on the gallery |
| D1 | WS server package: `ws` + TS, graceful shutdown, structured logging | 1d | the container starts, logs JSON lines, and on SIGTERM closes open sockets and exits 0 |
| D2 | Ticket-based handshake, `householdId` authorisation server-side | 1d | connecting with no ticket, a used ticket, or another household's ticket is rejected before any subscription is created |
| D3 | Connection registry keyed by household, presence tracking | 1d | two tabs of the same user count as one presence entry; disconnect clears it within one heartbeat interval |
| D4 | Redis pub/sub wiring + typed `events.ts` union contract | 1d | `packages/contracts` is imported by web, realtime and worker; a test publishes each variant and a subscriber receives it typed |
| D5 | Client `useHouseholdChannel` hook, reconnect w/ backoff, heartbeat | 1.5d | killing the realtime container reconnects with backoff and registers no duplicate handlers, proven in a Playwright test |
| D6 | Optimistic UI + server reconciliation on document mutations | 1d | a rejected optimistic insert rolls back and surfaces an error; an update with a stale `version` shows a conflict prompt rather than overwriting |
| D7 | `worker` container + BullMQ repeatable notification scan | 1d | the scan runs on schedule and resumes after a Redis restart without losing the repeatable job |
| D8 | Dual-logic rules: hard 90/60/30, soft 60-day annual nudge | 1d | seeded rows at T-91/-90/-61/-60/-31/-30 and one anniversary produce exactly the expected notification set; a second run produces none |
| D9 | In-app notification centre + WS push + email via Mailpit | 1.5d | one notification appears in the bell, over WS, and in Mailpit, rendered in the recipient's locale |
| D10 | `next-intl` setup, locale routing, switcher, persistence | 1d | every route lives under `/[locale]`; switching locale preserves the current path; the choice persists to `User.locale` |
| D11 | FR/EN/ES message catalogues, FR date/number formatting | 1.5d | `pnpm i18n:check` reports zero missing and zero orphan keys; French renders `31/12/2026` and `1 234,56 €` |
| D12 | WS resilience testing: reconnect storms, Redis loss, dupes | 1d | 50 simultaneous reconnects plus a Redis restart lose no events and create no duplicate rows |
| D13 | Accessibility + responsive QA pass | 1d | axe reports zero violations on every route at 375/768/1440 and the full upload flow is completable by keyboard only |
| **D14** | **Profile & settings page: display name, locale, avatar upload, active-now indicators** | **1d** | avatar upload replaces the previous object, renders through the authorised file route, and the members list shows live online state |

### Domain E — Data, Storage, Analytics & GDPR (Amir)

| # | Task | Est. | Done when |
|---|---|---|---|
| E1 | Full Prisma schema + initial migration | 1.5d | `prisma migrate dev` from zero reproduces §3; `prisma validate` passes; generated types compile in web, realtime and worker |
| E2 | Seed script: 2 households, 5 members, ~20 documents at varied expiries | 0.5d | `pnpm db:seed` produces rows hitting every status and every notification boundary |
| E3 | `docker-compose.override.yml` + data services (postgres, redis, minio, mailpit), MinIO bucket init and lifecycle policy | 0.5d | all four come up healthy on the internal network; `docker compose port minio 9000` fails on the base file and succeeds with the override |
| E4 | Storage adapter: `putObject`, `getObjectStream`, `deleteObject`, `objectKey` | 1d | all four are covered by tests against a live MinIO container; keys are produced only by `objectKey()` |
| E5 | Upload route: multipart, size/MIME validation, magic-byte sniffing | 1.5d | a renamed `.exe` is rejected by magic bytes; >10 MB is rejected before buffering; the happy path writes the object and the `Document` row in one transaction |
| E6 | Document CRUD queries + authorised file route, list + detail, pagination | 1d | list is household-scoped in the query itself, not filtered in the component; an id from another household 404s; `/api/documents/[id]/file` streams only after `assertCan` |
| E7 | Preview: client-side pre-upload preview + stored thumbnail generation | 1d | the chosen file renders in the browser before it is sent; after upload, images and PDFs both produce a stored thumbnail; a generation failure degrades to a placeholder without breaking the list |
| E8 | Household member management CRUD | 1d | a member with no login can be created; deleting a member holding documents is blocked with a clear message |
| E9 | Analytics queries: 12-month expiry timeline, category breakdown, savings projection | 1.5d | each figure comes from one Prisma aggregate, not from reducing all rows client-side |
| E10 | Recharts dashboard components | 2d | charts render real aggregates, respond at 375/768/1440, and hold contrast in both light and dark themes |
| E11 | GDPR export: ZIP of JSON + original files | 1.5d | the ZIP contains a manifest of every row referencing the user plus every original file, delivered through the authorised route |
| E12 | GDPR deletion: email confirmation + cascade verification | 1d | deletion requires an emailed confirmation link; a post-deletion scan finds no rows referencing the user and no orphaned MinIO objects |
| E13 | Privacy Policy + Terms of Service pages | 0.5d | both pages exist in all three locales, are reachable logged-out, and the policy names the third-party AI processor, what data leaves the server, retention, and how to exercise export and deletion |
| E14 | DB integrity: constraint tests, migration replay from scratch, index tuning | 1d | `docker compose down -v` → up → migrate → seed → smoke passes in nightly CI |
| **E15** | **Renewal action links (ANTS, service-public, ameli) per category** | **0.5d** | each HARD category maps to a real portal URL shown on the document detail and in the notification email, localised |

**Capacity:** 62.5 planned person-days against 100 available (4 × 25). The 37% gap is
deliberate: review, integration, meetings, and rework. Adrien 15 · Rasiol 15 · Alexandre 16.5
· Amir 16 — Adrien and Rasiol carry PO/TL and PM/Architect duties on top, which is why their
task load is lower.

---

## 8. Five-Week Schedule

### Week 1 — Foundations & Contracts

| Member | Tasks |
|---|---|
| **Adrien** | A1, A2, A3, A4, A5 · pair with Rasiol on C1 (two half-days) · kick off B1 collection · GitHub Projects backlog, timeboxed (PO) |
| **Rasiol** | C1, C2, C3 · **publish `session.ts` and `policy.ts` signatures on D1** · project plan, risk log, ceremony calendar (PM) · ADR log (Architect) |
| **Alexandre** | D0, D1, D4, D10 · **publish `packages/contracts/events.ts` on D2** |
| **Amir** | E1, E2, E3, E4 · **publish `storage/index.ts` and `documents/status.ts` on D3** |

Adrien's Week 1 has zero slack. **A5 (CI) is the designated slip item** — it is the only W1
task with no downstream dependents, so if the week runs long it moves to Monday of W2 and
nothing else moves.

> **Milestone W1 (Friday):** `docker compose up` serves `https://mespapiers.local` with a
> trusted cert. A user can sign up, log in, and land on an authenticated (empty) dashboard
> **rendered through the shared shell at `/fr/dashboard`**. A WS client connects and receives
> a heartbeat. Every interface in §5 is committed. CI is green on `main`.

### Week 2 — The Vertical Slice

The **only** goal this week is one complete path working end to end. Nothing else matters.

| Member | Tasks |
|---|---|
| **Adrien** | B2, B3, B4, B6 · code review turnaround under 4h |
| **Rasiol** | C4, C5, C12, C14 · delete the `AUTH_STUB` path |
| **Alexandre** | D2, D5, D6 |
| **Amir** | E5, E6, E7 |

> **Milestone W2 (Friday) — make-or-break:** Browser A uploads a passport photo → AI extracts
> type, authority and expiry → row persists → **Browser B's dashboard updates live with no
> refresh**, where B joined via a real invite rather than a seed. If this is not working by
> Thursday, analytics work stops and Amir joins the slice.

### Week 3 — Parallel Build-out

| Member | Tasks |
|---|---|
| **Adrien** | B5, B7, A6 · extraction accuracy iteration |
| **Rasiol** | C7, C8, C6 |
| **Alexandre** | D7, D8, D9 |
| **Amir** | E8, E9, E10 |

> **Milestone W3 (Friday):** Google and GitHub sign-in work end to end. Notifications fire
> correctly for seeded near-expiry documents (verified by time-travelled seed data). The
> analytics dashboard renders real aggregates from real rows.

### Week 4 — Hardening, Compliance, Polish

| Member | Tasks |
|---|---|
| **Adrien** | B8, A7, A9 · Chrome compat + zero-console-error sweep |
| **Rasiol** | C9, C10, C11 |
| **Alexandre** | D11, D3, D14 · every dev supplies their own translation keys by Wednesday |
| **Amir** | E11, E12, E13, E15 |

> **Milestone W4 (Friday) — FEATURE FREEZE.** All 19 module points implemented. Full
> regression pass on latest stable Chrome with a clean console. After this point, only bug
> fixes, tests and documentation are merged.

### Week 5 — Stabilisation & Defence

Monday is a whole-team bug bash against the W4 regression list. Then:

| Member | Tasks |
|---|---|
| **Adrien** | A8 · multi-user concurrency + load test (4+ simultaneous sessions) · PO validation of every module against the subject · rehearse the evaluator walkthrough, once with the network disabled |
| **Rasiol** | C13 · verify `.env` never entered git history · commit-distribution audit (`git shortlog -sne`) · final report + defence slides (PM) |
| **Alexandre** | D12, D13 |
| **Amir** | E14 · backup/restore doc · curated demo dataset |

> **Milestone W5:** Tag `v1.0.0`. On a **freshly cloned repo on a clean 42 machine**,
> `docker compose up` reaches a full working demo. Defence rehearsed end to end twice, once
> offline.

---

## 9. Dependencies

| Blocker | Owner | Blocks | Due | Mitigation |
|---|---|---|---|---|
| Compose + `.env.example` | Adrien | Everyone's local dev | W1 D2 | Highest priority on day 1; no feature work starts before it. |
| `session.ts` / `policy.ts` signatures | Rasiol | Alexandre (WS auth), Adrien & Amir (protected routes) | **W1 D1** | **Publish the TypeScript interface before the implementation exists** (§5). Ship `AUTH_STUB=1` returning a seeded context so nobody idles; delete it in W2. |
| `packages/contracts/events.ts` | Alexandre | Adrien & Amir (both publish events) | **W1 D2** | Typed union committed first; publishers code against the type. |
| `components/ui` primitives + `[locale]` shell (D0, D10) | Alexandre | Every screen anyone builds | W1 D3 | Built in W1 precisely so nobody hardcodes strings or invents a second Button. Retrofitting `[locale]` in W4 would touch every page during the freeze. |
| Prisma schema + generated types | Amir | All three others | W1 D3 | Whole-team schema review on W1 D1. Additive-only migrations after W2. |
| `storage/index.ts` + `deriveStatus()` | Amir | Adrien (extraction persistence), Alexandre (status badges) | W1 D3 | Signatures in §5; implementations follow in E4. |
| Upload + MinIO storage adapter | Amir | Adrien (needs real files for extraction) | W2 D2 | Adrien develops B2–B4 against local fixture files, swaps to `getObjectStream` afterwards. |
| `can()` policy module | Rasiol | Amir (analytics scoping), Alexandre (WS room authz) | W2 D4 | Signature agreed W1 D1; default-deny stub available immediately. |
| WS ticket endpoint | Rasiol | Alexandre (D2 handshake) | W2 D2 | Small and isolated — pull it forward if the session core runs late. |
| Household invite flow (C14) | Rasiol | The W2 two-browser milestone on real data | W2 D4 | Seeded households make the demo runnable from W1; C14 replaces the seed dependency before the W2 gate. |

**Ceremonies:** 15-minute standup daily at 10:00 · sprint planning Monday · risk check
Wednesday · **integration + demo Friday**, which is the milestone gate, not a status update.

**Definition of Done:** PR reviewed and approved · CI green · no console errors · no
container hostname in the network tab · one Zod schema shared by form and action ·
translation keys added for all three locales · responsive and keyboard-navigable at
375 / 768 / 1440 · Prisma migration committed if the schema changed · the task's **Done when**
demonstrated at Friday integration.

---

## 10. Risks

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | **Auth is hand-rolled, on the critical path, owned by the least experienced dev.** No Lucia package, no Arctic — sessions, OAuth and TOTP are all written from scratch by a dev with 1 year of experience, and three people are blocked on it. | **High** | Adrien pair-programs the session core through Week 1 and reviews every auth PR within 4h. Auth is front-loaded so OAuth (W3) and 2FA (W4) can slip without blocking anyone. Use the Auth Book and `auth_session.ts` as the specification — implement a known-good design, do not improvise one. |
| R2 | **AI extraction underperforms on real documents.** The vision assumes clean JSON; real photos are skewed, glared and cropped. | **High** | Collect real fixtures in Week 1 and build the eval harness *before* the UI. Ship the manual-correction path (B8) as a designed state, not a fallback — a wrong extraction must never be a dead end, which is also why `ACTION_REQUIRED` is a first-class status. |
| R3 | **Week 2 vertical slice slips.** Everything downstream assumes it works. | **High** | It is the sole W2 objective. Thursday checkpoint: if it isn't working, Amir drops analytics and joins. |
| R4 | **WebSocket authorisation done naively** — session cookies aren't reliably available at upgrade, and a client-declared room leaks another household's documents. | **High** | Short-lived single-use ticket minted by an authenticated route handler (C12), exchanged on connect. `householdId` resolved server-side from the session; **never** trusted from the client. |
| R5 | **Concurrency correctness is explicitly graded.** | Med | Enforce at the database, not in application code: `@@unique([documentId, kind])` on notifications, transactions for multi-row writes, `version` column for optimistic concurrency. Scripted 4-browser concurrent test in W5. |
| R6 | **19 points is a lot for 5 weeks.** | Med | Hard W4 freeze. Pre-agreed drop order if behind: (1) savings-projection chart → static mock, (2) analytics depth → fewer chart types, (3) Spanish → FR/EN only, costing 1 point. **Never drop a major** — the six majors are 12 of the 19 points. |
| R7 | **AI API cost / rate limits.** Opus 5 is $5/$25 per MTok and document images are token-heavy. | Med | Checksum cache (re-uploading the same file makes no API call), per-user daily cap, fixtures in CI instead of live calls, one shared key held by Adrien with a billing alert. |
| R8 | **Uneven commit distribution**, which the subject grades directly. | Med | No long-lived branches. Every member merges a PR to `main` at least 3× per week. Rasiol audits `git shortlog -sne` at each Friday integration and raises it immediately, not in Week 5. |
| R9 | Self-signed cert produces Chrome warnings, violating the clean-console requirement. | Low | `mkcert` local CA, documented in the README so evaluators can reproduce it. |
| **R10** | **The live AI call fails during the defence** — no network in the evaluation room, an expired key, or a rate limit. The flagship feature dies in front of the evaluators. | **Med** | `DEMO_MODE=1` replays committed fixture extractions with a simulated delay, exercising the same code path from `extractDocument()` down. Rehearse the walkthrough at least once with the network disabled (W5). |
| **R11** | **`mespapiers.local` needs an `/etc/hosts` entry and `mkcert -install` needs sudo** — neither may be available on the evaluation machine, so the demo cannot be reached at all. | **Med** | Issue the cert for `localhost` as well as `mespapiers.local` so `https://localhost` always works. Provide `make hosts` and put both the hosts line and the `mkcert -install` command at the top of the README. Test the fallback path on a machine that has never run the project. |

---

## 11. Verification

**Per-PR (automated):** `tsc --noEmit`, ESLint, `prisma validate`, migration drift check,
`check:env`, `i18n:check`, Vitest units, `next build`, `docker compose build`.

**Weekly (at Friday integration, manual):**

1. `git clone` fresh → `cp .env.example .env` → `docker compose up` → app reachable over
   HTTPS with no console errors.
2. Sign up → verify → log in → log out → log back in.
3. Upload a real document → confirm extracted type/authority/expiry against the actual paper.
4. Open two browsers as two household members → mutate in one → confirm the other updates
   live without a refresh.
5. Log in as a `MEMBER` → confirm another member's documents are neither visible nor
   reachable by direct URL **nor by direct file URL**.
6. Open the Chrome network tab across the whole flow → confirm every request goes to
   `mespapiers.local` and none to a container hostname.

**Week 5 acceptance:**

- **Concurrency:** 4 browsers, simultaneous uploads and edits on the same household. Verify
  no duplicate notifications, no lost updates, no corrupted rows, and that a stale-`version`
  edit is rejected with a conflict rather than silently overwriting.
- **Notifications:** seed documents at T-91, T-90, T-61, T-60, T-31, T-30 days and one
  contract anniversary. Run the worker. Verify exactly one notification per
  `(document, kind)` — then run it again and verify nothing new is sent.
- **Migration replay:** drop the volume, `prisma migrate deploy` from zero, seed, smoke test.
- **GDPR:** request an export, confirm the ZIP contains both metadata and original files;
  request deletion, confirm the email step, verify the cascade leaves no orphaned rows or
  MinIO objects.
- **i18n:** walk every screen in FR, EN and ES. No missing keys, no layout breakage.
- **Console:** every route in latest stable Chrome, zero warnings and zero errors.
- **Offline demo:** run the full walkthrough with `DEMO_MODE=1` and the network disabled.
- **Cold machine:** clone onto a machine that has never run the project, follow the README,
  reach the dashboard — including the `https://localhost` fallback path.
