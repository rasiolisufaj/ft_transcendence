# MesPapiers — 5-Week Implementation Plan

> **For implementers:** tasks below are sized for one human developer-day and each
> carries a **Done when** acceptance check. When a task is handed to an agentic
> worker instead, expand it first into a per-task TDD plan under
> `docs/plans/YYYY-MM-DD-<task-id>.md` — failing test, run it, minimal
> implementation, run it, commit. Never hand a WBS row straight to an agent.

**Goal:** Ship MesPapiers — a personal paperwork assistant that turns photographed French
documents into tracked, deadline-aware typed objects, lets users interrogate and compare them
through an AI assistant, and surrounds it with a mutual-aid community where people help each
other through administrative procedures — as a **22-point**, 4-person, 5-week graded project.

**Architecture:** A containerised TypeScript monorepo behind an NGINX TLS proxy. Next.js
(App Router) owns UI and HTTP backend; a separate Node WebSocket service fans community and
notification events out via Redis pub/sub; a separate worker container runs the deadline scan.
PostgreSQL via Prisma is the single source of truth, MinIO holds the files, and every document
status is derived at read time rather than stored.

**Tech Stack:** TypeScript · Next.js 15 (App Router) · Tailwind · Prisma + PostgreSQL 17 ·
Redis 7 · `ws` · BullMQ · MinIO · NGINX · Docker Compose · `next-intl` ·
Anthropic `claude-opus-5` · Vitest + Playwright · GitHub Actions

**Specs:** [`mespapiers_project_vision.md`](mespapiers_project_vision.md) (product) ·
[`subject_requirements.md`](subject_requirements.md) (graded requirements). This plan argues
from both; executors read all three.

> ⚠️ **The vision document is currently stale.** It still describes the earlier
> household-sharing concept with an analytics dashboard. This plan reflects the current scope:
> individual document ownership, an AI assistant with price comparison, and an entraide
> community. Reconcile the vision doc against §1 and §2 before Week 1 planning, or the two
> specs will contradict each other in front of the evaluators.

---

## Context

The team of 4 has a project vision and a graded subject, but no repository, no schedule, and
no allocation. The current scope is **22 module points across 7 major and 8 minor modules** —
an aggressive scope for 5 weeks with two junior developers. This plan converts the vision into
a dependency-ordered, person-by-person schedule with a hard feature freeze, so that the graded
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
- Soft-renewal nudge fires at exactly **60 days** before the contract anniversary.
- Document statuses are exactly **VALID · EXPIRING_SOON · EXPIRED · ACTION_REQUIRED**,
  derived by `deriveStatus()` (§5) — never stored.
- **Any price or market comparison produced by the assistant is labelled indicative**, with
  the source of the comparison stated (model knowledge or live lookup) and a visible
  disclaimer that it is not financial advice. A comparison rendered as a bare authoritative
  figure fails review.
- Privacy Policy and Terms of Service pages must exist, be reachable without logging in, and
  carry real content in all three locales.

**Security and correctness**

- Everything a browser touches is **HTTPS through NGINX**. No page, asset, file download or
  WebSocket may address a container hostname directly. Backend-internal traffic may be plain.
- Every form is validated by **one Zod schema module imported by both the client component
  and the server action**. Two schemas that "match" is a defect, not an implementation.
- Uploads: max **10 MB**, MIME allow-list `image/jpeg`, `image/png`, `image/webp`,
  `application/pdf`, verified by **magic bytes** server-side, never by the declared type.
- **A user's document content never reaches the community layer.** Assistant context is built
  server-side from documents the requesting user owns; nothing from a document is ever echoed
  into a channel, a thread or a direct message by the system.
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

MesPapiers is a paperwork assistant for people navigating French administration. It answers
two different kinds of "I don't know what to do here" — the kind the data can answer, and the
kind only someone who has been through it can answer.

**Pillar 1 — the assistant.** A user photographs a document; an AI vision model extracts its
type, issuing authority and expiry date, turning a flat image into a structured, typed object.
A dashboard shows every document's status, and a scheduler warns before hard legal deadlines
(passports, *titres de séjour*, *contrôle technique*) and soft financial ones (auto-renewing
insurance contracts, where the risk is overpayment rather than loss of cover). On top of that
sits a streaming chat: the user asks questions about a stored document, and can push further —
"is this premium reasonable?" — with the document's own text passed into the prompt.

**Pillar 2 — the entraide community.** Topic channels (*titre de séjour*, *assurance auto*,
CAF) where users post questions and are answered by people who have been through the same
procedure, with direct messaging, friends, per-channel moderation, and a reputation signal so
that reliable contributors are visible.

**Team and roles** (per the subject's role requirement):

| Member | Roles | Focus | Experience |
|---|---|---|---|
| Adrien | Product Owner · Technical Lead | Infrastructure, CI, AI extraction + assistant, review | 3 years |
| Rasiol | Project Manager · Architect | Auth, security, permissions | 1 year |
| Alexandre | Developer | Real-time, messaging, notifications, i18n, UI shell | — |
| Amir | Developer | Database, storage, community data layer, GDPR | — |

---

## 2. Confirmed Decisions

| Decision | Choice | Consequence |
|---|---|---|
| Deployment | Local Docker Compose only | NGINX + locally-trusted cert. CI tests and builds images; it does not deploy. |
| Tenancy | **Individual ownership, no household** | A document belongs to one `User`. No shared family workspace, no invites, no household RBAC. Sharing between people happens in the community layer, never on documents. |
| Document modelling | **Class-table inheritance** | A base `Document` row plus one typed subtype row per category. See §3. |
| AI scope | **LLM interface only — no RAG** | Document text is passed directly into the prompt. No embeddings, no vector store, no maintained price dataset. See the correction below. |
| Community | **Channels are the "organization" module** | A channel is an organisation instance: created, joined, left, moderated, with per-channel roles. |
| Analytics dashboard | **Dropped** | It was a 2-point major that served the household concept. Its points are replaced by the community modules, which the product actually needs. |
| Assistant transport | **SSE, not WebSocket** | See the correction below. |
| File storage | MinIO container (S3-compatible) | Internal network only. Files reach the browser through an authorised route handler — see below. |
| Languages | FR / EN / ES via `next-intl` | No RTL work. Build with Tailwind logical properties anyway so Arabic stays cheap later. |
| Auth | Own the session table (Lucia pattern) | See the correction below — this is hand-rolled, not a library install. |
| AI provider | Anthropic `claude-opus-5` via `@anthropic-ai/sdk` | Structured extraction with `messages.parse()` + Zod; streaming for the assistant. |
| Locale routing | `app/[locale]/...` from Week 1 | Every route is built inside the locale segment from day one. Retrofitting it in Week 4 would mean touching every page during the freeze. |
| File serving | Authorised route handler, **not** presigned URLs | See below. |

### Correction on the AI scope — why there is no RAG module

A RAG module was scoped and then removed. The reasoning is worth recording, because it will be
asked at evaluation.

The subject's RAG major requires *"proper context retrieval"* over *"a large dataset."* At
personal scale — a few dozen documents per user, each a page or two of extracted text — there
is nothing to retrieve: the relevant document is already known, either because the user
selected it or because it is the only one of its category. Building embeddings and a vector
store to search a corpus that fits in a single context window would be architecture theatre,
and a retrieval step that does not actually retrieve is exactly the kind of module an
evaluator scores at zero.

**Decision:** the assistant passes the selected document's extracted text directly into the
prompt. The **LLM interface** major is claimed — streaming, error handling and rate limiting
are all genuinely implemented (§B9–B11) — and the RAG major is not claimed at all. If price
comparison needs current figures rather than model knowledge, a web search tool is added to
the same interface via tool use; that is still the LLM interface module, not a second one.

### Correction on assistant transport — SSE, not WebSocket

The instinct is to route everything real-time through the one WebSocket service. It is the
wrong call for the assistant. Assistant streaming is **single-user and unidirectional** —
tokens flow server → one browser, with no fan-out, no presence, no room membership. Pushing it
through the WS service means minting a ticket, resolving a room, and routing through Redis for
a stream that has exactly one recipient who is already authenticated on the HTTP request.

**Decision:** the assistant streams over **SSE from a Next.js route handler**
(`POST /api/assistant/stream`), inside the existing session. The **WebSocket service owns
multi-user real-time** — channel events, direct messages, presence, notification push — which
is where the fan-out actually exists and where the real-time major is claimed and demonstrated.

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
signature matches hands out a URL that bypasses `can()` for its whole lifetime — awkward when
RBAC is a module being graded.

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
     │  + SSE      │                   │ channels/DM  │
     └──────┬──────┘                   └──────┬───────┘
            │            ┌──────────┐         │
            ├────────────┤  worker  ├─────────┤   cron: deadline scan
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

PostgreSQL via Prisma. Three concerns live side by side: identity, the document vault, and the
community.

**Identity and access**

| Model | Key fields | Purpose |
|---|---|---|
| `User` | `id`, `email`, `passwordHash?`, `displayName`, `avatarKey?`, `locale`, `totpSecret?`, `totpEnabled`, `globalRole`, `reputation` | A login and the owner of documents. `passwordHash` nullable for OAuth-only accounts. `globalRole` is `USER` or `ADMIN`. |
| `Session` | `id` (SHA-256 of token), `userId`, `expiresAt`, `twoFactorVerified`, `ipAddress`, `userAgent` | Opaque tokens; the raw token is never stored. |
| `OAuthAccount` | `userId`, `provider`, `providerUserId` | `@@unique([provider, providerUserId])` |
| `AuditLog` | `actorUserId`, `action`, `targetType`, `targetId`, `channelId?`, `metadata` | Evidence for the permissions and GDPR modules. |
| `DataRequest` | `userId`, `type`, `status`, `confirmedAt`, `downloadKey` | GDPR export / deletion with email confirmation. |

**Document vault — class-table inheritance**

The base row carries what every document has; one subtype row per category carries what only
that category has. Prisma has no native inheritance, so the pattern is a **shared primary
key**: the subtype's `id` is both its PK and a FK to `Document.id`.

| Model | Key fields |
|---|---|
| `Document` (base) | `id`, `ownerId`, `category`, `deadlineType`, `title`, `issuingAuthority`, `issueDate`, `targetDate`, `storageKey`, `mimeType`, `sizeBytes`, `checksum`, `extractionStatus`, `version`, `metadata Json?` |
| `DocumentIdentity` | `id`→Document, `holderName`, `documentNumber`, `nationality?` |
| `DocumentInsurance` | `id`→Document, `insurer`, `policyNumber`, `premiumPerYear`, `coverageType`, `anniversaryDate` |
| `DocumentVehicle` | `id`→Document, `plate`, `makeModel`, `firstRegistration?` |
| `DocumentHousing` | `id`→Document, `addressLine`, `landlordOrInsurer?`, `monthlyAmount?` |
| `DocumentHealth` | `id`→Document, `organisation`, `beneficiaryNumber?` |
| `DocumentFinancial` | `id`→Document, `institution`, `accountRef?`, `amount?` |
| `DocumentExtraction` | `documentId`, `model`, `rawJson`, `confidence`, `inputTokens`, `outputTokens` |

`metadata Json?` on the base row exists **only** for `category = OTHER`. A category with a
subtype table storing fields in JSON instead is a review failure — the whole point of the
inheritance is typed columns you can query.

**Assistant**

| Model | Key fields |
|---|---|
| `AssistantConversation` | `id`, `userId`, `documentId?`, `title` |
| `AssistantMessage` | `conversationId`, `role`, `content`, `inputTokens?`, `outputTokens?`, `kind` (`ANSWER` \| `COMPARISON`) |

`kind = COMPARISON` is what the UI keys the indicative-figure disclaimer off — it is a data
property, not a rendering afterthought.

**Community**

| Model | Key fields | Purpose |
|---|---|---|
| `Channel` | `id`, `slug`, `name`, `description`, `createdById` | The organisation instance. |
| `ChannelMembership` | `userId`, `channelId`, `role` (`MEMBER` \| `MODERATOR`), `joinedAt` | `@@unique([userId, channelId])` |
| `Thread` | `id`, `channelId`, `authorId`, `title`, `body`, `hiddenAt?`, `acceptedAnswerId?` | A question. |
| `Answer` | `id`, `threadId`, `authorId`, `body`, `hiddenAt?` | A reply. |
| `Vote` | `userId`, `answerId`, `value` | `@@unique([userId, answerId])` — the reputation source. |
| `Friendship` | `requesterId`, `addresseeId`, `status` (`PENDING`/`ACCEPTED`/`BLOCKED`) | `@@unique([requesterId, addresseeId])` |
| `Conversation` / `Message` | `conversationId`, `senderId`, `body`, `readAt?` | 1:1 direct messaging. |
| `Mute` | `userId`, `channelId`, `until`, `byUserId` | Moderation action, per channel. |
| `Notification` | `userId`, `documentId?`, `kind`, `scheduledFor`, `sentAt`, `readAt` | `@@unique([documentId, kind])` for deadline kinds. |

Enums: `DocumentCategory` (IDENTITY, VEHICLE, HOUSING, HEALTH, INSURANCE, FINANCIAL, OTHER) ·
`DeadlineType` (HARD, SOFT, PERIODIC) · `GlobalRole` (USER, ADMIN) · `ChannelRole` (MEMBER,
MODERATOR) · `NotificationKind` (T90, T60, T30, ANNUAL_NUDGE, PERIODIC_DUE, THREAD_ANSWERED,
MESSAGE_RECEIVED, FRIEND_REQUEST) · `ExtractionStatus` (PENDING, NEEDS_REVIEW, CONFIRMED,
FAILED).

Four schema rules the team should not break:

1. **Do not store document status.** `VALID / EXPIRING_SOON / EXPIRED / ACTION_REQUIRED` is
   derived from `targetDate`, `deadlineType` and `extractionStatus` at read time by one shared
   helper (§5). A stored status column will silently drift out of sync with the cron job and
   the UI will contradict itself.
2. **`@@unique([documentId, kind])` on `Notification` is the idempotency guarantee** for
   deadline notifications. The scheduler is allowed to be at-least-once; the database makes it
   effectively-once. This is how "no data corruption or race conditions" gets satisfied at the
   storage layer rather than by hoping.
3. **`Document.version` for optimistic concurrency.** Two browser tabs editing the same
   document is the concurrent-write case the subject asks about. Every update carries the
   version it read; a mismatch is a 409, not a silent overwrite.
4. **`Vote` and `ChannelMembership` are uniquely constrained**, not de-duplicated in
   application code. Double-voting and double-joining are the community layer's equivalent
   concurrency case and are demonstrated the same way.

Indexes: `Document(ownerId, targetDate)`, `Document(ownerId, category)`, `Document(checksum)`,
`Notification(scheduledFor, sentAt)`, `Session(userId)`, `Thread(channelId, createdAt)`,
`Answer(threadId)`, `Message(conversationId, createdAt)`.

**Reputation → Helper.** `User.reputation` is a denormalised counter incremented in the same
transaction as the vote, never recomputed on read. Crossing the threshold is what makes a user
display as **Helper** — a badge, not a permission (§ policy).

### CI/CD (GitHub Actions)

- **`ci.yml`** on every PR: `tsc --noEmit` → ESLint → `prisma validate` + `prisma migrate diff`
  drift check → `pnpm check:env` → `pnpm i18n:check` → Vitest unit tests → `next build` →
  `docker compose build`.
- **`e2e.yml`** nightly + on `main`: `docker compose up -d`, Playwright smoke suite
  (signup → login → upload → extract → ask the assistant → post in a channel), upload traces
  on failure.
- **Branch protection on `main`:** no direct pushes, one approving review, CI green.
  Adrien reviews everyone; Rasiol reviews Adrien.
- AI tests run against **committed fixtures**, never live API calls.

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
│  ├─ web/                            # Next.js — UI + HTTP backend + SSE
│  │  ├─ prisma/{schema.prisma,migrations/,seed.ts}                      # [Amir]
│  │  ├─ messages/{fr.json,en.json,es.json}                              # [Alexandre]
│  │  └─ src/
│  │     ├─ app/[locale]/(auth)/{login,signup}/                          # [Rasiol]
│  │     ├─ app/[locale]/(app)/{dashboard,documents,assistant,channels,messages,settings}/
│  │     ├─ app/[locale]/(admin)/                                        # [Rasiol]
│  │     ├─ app/[locale]/(public)/{privacy,terms}/                       # [Amir]
│  │     ├─ app/api/                  # file route, assistant SSE, ws-ticket, oauth callbacks
│  │     ├─ components/ui/            # shared primitives — the design system [Alexandre]
│  │     ├─ components/{documents,assistant,community,notifications}/
│  │     ├─ lib/auth/{session.ts,policy.ts,totp.ts,oauth/}               # [Rasiol]
│  │     ├─ lib/ai/{client.ts,extract.ts,assistant.ts,prompt.ts}         # [Adrien]
│  │     ├─ lib/storage/index.ts                                         # [Amir]
│  │     ├─ lib/documents/{queries.ts,status.ts,schemas.ts,subtypes.ts}  # [Amir]
│  │     ├─ lib/community/{channels.ts,threads.ts,moderation.ts}         # [Amir]
│  │     └─ lib/events/publish.ts     # thin wrapper over Redis publish
│  ├─ realtime/src/{server.ts,registry.ts,subscribe.ts,presence.ts}      # [Alexandre]
│  └─ worker/src/{index.ts,scan.ts,rules.ts,mailer.ts}                   # [Alexandre]
└─ tests/{e2e/, fixtures/documents/}                                     # [Adrien]
```

Three structural rules:

- **`lib/documents/schemas.ts` holds the Zod schemas imported by both the form and the server
  action.** This is the file that makes "validated on both sides" true rather than claimed.
- **`lib/documents/subtypes.ts` is the single registry mapping category → subtype model, Zod
  schema and form fields.** Adding a document category touches this file and nothing else.
- **`packages/contracts` is the only code shared across apps.** If web, realtime and worker
  all need a type, it lives there. Nothing else crosses an app boundary.

---

## 5. Published Interfaces

These signatures are committed in **Week 1, before their implementations exist**, so that
everyone codes against a type instead of waiting. Changing one after publication is a
whole-team decision announced at standup.

`Document`, `DocumentCategory`, `DeadlineType`, `ExtractionStatus`, `GlobalRole` and
`ChannelRole` are imported from `@prisma/client` (generated by E1). `Locale` is
`'fr' | 'en' | 'es'`, exported from `apps/web/src/i18n/config.ts` (D10).

### Auth — `apps/web/src/lib/auth/session.ts` (Rasiol, due W1 D1)

```ts
export type SessionUser = {
  id: string; email: string; displayName: string;
  avatarKey: string | null; locale: Locale; totpEnabled: boolean;
  globalRole: GlobalRole; reputation: number;
};

export type SessionContext = {
  session: { id: string; expiresAt: Date; twoFactorVerified: boolean };
  user: SessionUser;
};

export async function validateSessionToken(token: string): Promise<SessionContext | null>;
export async function getCurrentUser(): Promise<SessionContext | null>;  // reads the cookie
export async function requireUser(): Promise<SessionContext>;            // redirects if absent
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }>;
export async function invalidateSession(sessionId: string): Promise<void>;
```

With `AUTH_STUB=1`, `getCurrentUser()` and `validateSessionToken()` return a seeded
`SessionContext` so nobody idles waiting for C1. The stub is deleted in W2 and CI fails if
`AUTH_STUB` appears outside `.env.example`.

### Permissions — `apps/web/src/lib/auth/policy.ts` (Rasiol, signature due W1 D1)

```ts
export type Action =
  | 'document:read' | 'document:create' | 'document:update' | 'document:delete'
  | 'assistant:ask'
  | 'channel:create' | 'channel:update' | 'channel:delete' | 'channel:join'
  | 'channel:moderate'                       // hide a post, mute a member
  | 'thread:create' | 'thread:update' | 'thread:delete'
  | 'answer:create' | 'answer:update' | 'answer:delete' | 'answer:vote'
  | 'message:send' | 'friend:request'
  | 'user:manage' | 'channel:manageRoles'    // admin surface
  | 'gdpr:export' | 'gdpr:delete';

export type Resource = {
  ownerUserId?: string | null;   // documents, threads, answers, messages
  channelId?: string | null;     // scopes moderator checks
};

export function can(ctx: SessionContext, action: Action, resource: Resource): boolean;
export function assertCan(ctx: SessionContext, action: Action, resource: Resource): void;
```

`can()` is **default-deny**: an unknown action returns `false` before any role logic runs.
Three tiers resolve in order — `globalRole === 'ADMIN'` wins everywhere; a `MODERATOR`
membership on `resource.channelId` grants `channel:moderate` and content deletion **inside
that channel only**; otherwise ownership (`ctx.user.id === resource.ownerUserId`) decides.
**Helper is not a tier** — it is a reputation badge and grants nothing, deliberately, so that
reputation can never be farmed into moderation power.

### Realtime events — `packages/contracts/src/events.ts` (Alexandre, due W1 D2)

```ts
export type RealtimeEvent =
  | { type: 'thread.created';  channelId: string; threadId: string; actorUserId: string; at: string }
  | { type: 'answer.created';  channelId: string; threadId: string; answerId: string; actorUserId: string; at: string }
  | { type: 'answer.voted';    channelId: string; answerId: string; score: number; at: string }
  | { type: 'content.hidden';  channelId: string; targetType: 'thread' | 'answer'; targetId: string; at: string }
  | { type: 'message.created'; userId: string; conversationId: string; messageId: string; at: string }
  | { type: 'friend.changed';  userId: string; otherUserId: string; status: string; at: string }
  | { type: 'notification.created'; userId: string; notificationId: string; at: string }
  | { type: 'presence.changed'; userId: string; online: boolean; at: string };

export const channelTopic = (channelId: string) => `channel:${channelId}`;
export const userTopic    = (userId: string)    => `user:${userId}`;
export async function publish(event: RealtimeEvent): Promise<void>;
```

Two topic families: **channel topics** fan out to every subscribed member, **user topics** are
private to one account (DMs, notifications, friend changes). Subscription rights are always
resolved server-side from the session and the membership table, never from the client.

### Storage — `apps/web/src/lib/storage/index.ts` (Amir, due W1 D3)

```ts
export type StoredObject = { key: string; sizeBytes: number; checksum: string; mimeType: string };

export function objectKey(userId: string, documentId: string, filename: string): string;
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
  subtypeFields:    z.record(z.string(), z.unknown()),  // validated against subtypes.ts
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

`subtypeFields` is narrowed by the category's Zod schema from `lib/documents/subtypes.ts`
before the subtype row is written. A field the schema doesn't know is dropped, never persisted
into the base `metadata`.

### Assistant — `apps/web/src/lib/ai/assistant.ts` (Adrien, due W2 D3)

```ts
export type AssistantRequest = {
  userId: string;
  conversationId: string;
  documentId: string | null;      // null = general question, no document context
  question: string;
};

export type AssistantChunk =
  | { type: 'token'; text: string }
  | { type: 'done'; kind: 'ANSWER' | 'COMPARISON'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; code: 'RATE_LIMITED' | 'UPSTREAM' | 'TIMEOUT' | 'REFUSED'; messageKey: string };

export async function* streamAssistant(req: AssistantRequest): AsyncGenerator<AssistantChunk>;
```

Context is assembled server-side: the document is loaded, `assertCan(ctx,'document:read',doc)`
runs, and only then is its extracted text placed in the prompt. `documentId` arriving from the
client is a *request*, never a grant. `error.messageKey` is an i18n key — the assistant never
streams an untranslated English error into a French UI.

### Status derivation — `apps/web/src/lib/documents/status.ts` (Amir, due W1 D3)

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
2. `HARD`: `targetDate < now` → `EXPIRED`; within 90 days → `EXPIRING_SOON`; else `VALID`.
3. `SOFT`: within 60 days of the next anniversary of `targetDate` → `EXPIRING_SOON`; else
   `VALID`. **A soft renewal never becomes `EXPIRED`** — the risk is overpayment, not loss of
   service.
4. `PERIODIC`: within 30 days of the next occurrence of the declared interval →
   `EXPIRING_SOON`; else `VALID`. Also never `EXPIRED` — a missed declaration is re-declared,
   not lost.

---

## 6. Module Ownership — 22 Points

| Module | Type | Pts | Owner |
|---|---|---|---|
| Framework for frontend and backend (Next.js) | Major | 2 | Adrien |
| Complete LLM system interface (assistant, streaming) | Major | 2 | Adrien |
| Standard user management and authentication | Major | 2 | Rasiol |
| Advanced permissions system (roles, moderation, admin) | Major | 2 | Rasiol |
| Remote authentication with OAuth 2.0 | Minor | 1 | Rasiol |
| Complete 2FA system (TOTP) | Minor | 1 | Rasiol |
| Real-time features using WebSockets | Major | 2 | Alexandre |
| User interaction (chat, profiles, friends) | Major | 2 | Alexandre |
| Complete notification system | Minor | 1 | Alexandre |
| Multiple languages (FR/EN/ES) | Minor | 1 | Alexandre |
| Organization system (community channels) | Major | 2 | Amir |
| Use an ORM for the database (Prisma) | Minor | 1 | Amir |
| File upload and management system | Minor | 1 | Amir |
| Image recognition and tagging (document OCR) | Minor | 1 | Adrien |
| GDPR compliance features | Minor | 1 | Amir |
| **Total** | | **22** | 7 major + 8 minor |

**On the point budget.** The subject requires 14 and caps the bonus at **+5**, so at most
**19 points can ever count**. The plan carries 22 deliberately: the three points above the cap
are *insurance against a module failing validation at evaluation*, not extra credit. Nobody
should spend an extra day polishing module twenty-two while module three is shaky.

**On the balance:** Rasiol carries 6 module points but writes almost no feature UI. Adrien
carries 5 and owns the entire infrastructure, CI and review load — none of which scores points
but all of which is required. Alexandre (6) and Amir (5) carry the heaviest UI surface.

**Module ownership is not exclusive authorship.** D14 (profile & settings UI) is built by
Alexandre but counts towards Rasiol's user-management module; B8 (extraction correction UI) is
built by Alexandre but counts towards Adrien's image-recognition minor; Amir builds the
channel data layer that Alexandre's real-time module demonstrates. Say this out loud at
evaluation rather than letting it look like a gap.

---

## 7. Work Breakdown Structure

Every task carries a **Done when** — the observable check that closes it.

### Domain A — Architecture & Infrastructure (Adrien)

| # | Task | Est. | Done when |
|---|---|---|---|
| A1 | Repo init, pnpm workspace, Next.js App Router + Tailwind + strict `tsconfig`, ESLint/Prettier | 0.5d | `pnpm i && pnpm build` succeeds from a clean clone; `tsc --noEmit` and ESLint pass with zero warnings |
| A2 | `docker-compose.yml` — app services (nginx, web, realtime, worker), two networks, healthchecks, named volumes | 1d | `docker compose up` brings all four to healthy; `docker compose ps` shows every healthcheck passing |
| A3 | NGINX reverse proxy, `mkcert` TLS for `mespapiers.local` + `localhost`, WS upgrade routing, SSE buffering disabled on `/api/assistant`, security headers | 1d | Chrome shows a padlock with no interstitial; `/ws` returns 101; an SSE response streams token-by-token rather than arriving buffered; `curl -I` shows HSTS, X-Content-Type-Options, Referrer-Policy, CSP |
| A4 | `.env.example` + secret handling, `pnpm check:env`, `.gitignore` audit | 0.5d | `git log --all -- .env` is empty; `check:env` fails CI when a key used in code is missing from the example |
| A5 | GitHub Actions `ci.yml`, branch protection, PR template | 1d | a PR containing a deliberate type error is blocked and cannot be merged |
| A6 | Playwright + `e2e.yml` against live compose | 1d | the signup→upload→extract→ask→post spec runs against compose in CI and uploads a trace on failure |
| A7 | Performance pass: N+1 audit, Next caching, image optimisation | 1d | Prisma query logging shows no per-row query in the dashboard or channel list path; LCP under 2.5s locally |
| A8 | Image slimming (standalone output, multi-stage builds) | 0.5d | `web` image under 400 MB; cold `docker compose build` under 5 min |
| A9 | README, architecture docs, ADR log, demo script | 1d | a teammate reaches a running app on a clean machine following the README alone; the ADR log has one entry per row of §2, including the three corrections |

**Domain A total: 7.5d**

### Domain B — AI Extraction & Assistant (Adrien)

| # | Task | Est. | Done when |
|---|---|---|---|
| B1 | Fixture set: 12–15 redacted real French documents, 2–3 per member, collected W1 | 0.5d | `tests/fixtures/documents/` holds ≥12 files, each with a hand-written `expected.json` ground truth |
| B2 | Anthropic SDK wiring, `claude-opus-5`, image + PDF content blocks | 0.5d | a fixture image and a fixture PDF both round-trip and their raw responses are logged |
| B3 | Zod extraction schema + `messages.parse()` structured output + subtype narrowing | 1d | `extractDocument()` returns a value typed `Extraction`; a malformed reply is rejected by Zod and never persisted; `subtypeFields` is narrowed by the category schema before write |
| B4 | Prompt engineering + fixture-based accuracy eval harness | 1d | `pnpm eval:extraction` prints per-field accuracy; ≥80% exact match on `documentType` and `targetDate` across the fixture set |
| B5 | Extraction error handling: refusals, low confidence, timeouts, malformed pages | 1d | refusal, timeout, oversize, empty PDF and a garbage image each map to a distinct `ExtractionStatus` and a translated user message, covered by unit tests with mocked responses |
| B6 | `DocumentExtraction` audit persistence + token accounting | 0.5d | every call writes a row with token counts; one query reports spend for the month |
| B7 | Checksum-based caching + per-user daily extraction cap | 0.5d | re-uploading a byte-identical file makes zero API calls (asserted with a spy); the 21st upload in 24h by one user is rejected |
| B8 | *(built by Alexandre, credited here)* Manual-correction UI for low-confidence extractions | — | an extraction below 0.7 confidence lands on a review screen where every base **and subtype** field is editable; confirming flips `extractionStatus` to `CONFIRMED` and the derived status follows |
| **B9** | **Assistant streaming: `POST /api/assistant/stream` SSE route, `streamAssistant()`, conversation + message persistence** | **1.5d** | tokens render progressively in the browser; closing the tab mid-stream aborts the upstream call; the full exchange is persisted with token counts |
| **B10** | **Document context injection + comparison mode + indicative-figure disclaimer** | **1d** | asking about a document the user does not own returns 403 before any prompt is built; a comparison answer is persisted with `kind = COMPARISON` and renders with the disclaimer; a test asserts the disclaimer cannot be suppressed by the model's output |
| **B11** | **Assistant error handling + per-user rate limiting** | **0.5d** | upstream 429, timeout and refusal each surface a distinct translated message in-stream; the 31st assistant message in an hour by one user is rejected with `RATE_LIMITED` |

**Domain B total: 8d** (B8's 1d sits in Domain D)

### Domain C — Auth, Security & Permissions (Rasiol)

| # | Task | Est. | Done when |
|---|---|---|---|
| C1 | Session core: Argon2id, opaque token, SHA-256 storage, `validateSessionToken()` | 2d | unit tests cover creation, hash lookup, expiry, sliding renewal, invalidation; a test asserts the raw token appears in no column |
| C2 | Signup / login / logout server actions + shared Zod schemas | 1d | the flow works end to end and a test proves the form and the action import the *same* schema module |
| C3 | Route middleware, `getCurrentUser()`, protected layout, `AUTH_STUB` | 0.5d | an unauthenticated request to any `(app)` route redirects to `/login`; `AUTH_STUB=1` returns the seeded context |
| C4 | RBAC: `can(ctx, action, resource)` policy module, default-deny, three-tier resolution | 1.5d | a truth-table test covers every Action × (admin / channel-moderator / owner / stranger); an unknown action returns `false`; a Helper-reputation user gets no extra permission |
| C5 | Apply ownership guards to every server action, query and route handler | 1d | a scripted request for another user's document returns 403 from the server action, the list query, `/api/documents/[id]/file` **and** the assistant stream route |
| C6 | `AuditLog` writes on all privileged actions | 0.5d | every mutating action in the `Action` union writes a row; moderation actions record the channel and the target |
| C7 | OAuth 2.0 — Google, authorization-code + PKCE, hand-rolled | 1.5d | sign-in completes with `state` and `code_verifier` both single-use and expiring; a replayed callback is rejected |
| C8 | OAuth 2.0 — GitHub + account-linking edge cases | 1d | signing in with GitHub on an email that already has a password account links to the same `User`; tested in both orders |
| C9 | TOTP 2FA: enrollment QR, verification, recovery codes | 1.5d | the QR scans in a real authenticator; a code from ±1 window verifies; each of 10 recovery codes works exactly once |
| C10 | Step-up 2FA on sensitive actions (delete, export) | 0.5d | document delete and GDPR export demand a fresh TOTP when `twoFactorVerified` is stale |
| C11 | Rate limiting on auth endpoints, CSRF, session rotation | 1d | 6 failed logins in 15 min lock the endpoint; the session id rotates on login and on privilege change; a cross-site POST without the token is rejected |
| C12 | WS ticket endpoint (short-lived, single-use) for Alexandre | 0.5d | a ticket is single-use, expires in 60s, is bound to the user, and a replay is rejected |
| C13 | Security review: OWASP pass, secrets audit, dependency audit | 1d | the OWASP Top-10 checklist is filled in with per-item evidence; `pnpm audit` reports no high/critical; `gitleaks` finds nothing in history |
| **C14** | **Admin surface + role management: user list/CRUD, promote/demote channel moderators, reputation→Helper threshold job** | **1.5d** | an ADMIN promotes a member to MODERATOR in one channel and that user gains hide/mute **only there**; a non-admin hitting the admin route gets 403, not a blank page; crossing the reputation threshold flips the Helper badge without granting any action |

**Domain C total: 15d**

### Domain D — Real-Time, Messaging, Notifications, i18n & Shell (Alexandre)

| # | Task | Est. | Done when |
|---|---|---|---|
| D0 | App shell: `app/[locale]` layout, nav, `components/ui` primitives (Button, Card, Badge, Dialog, Input, Table, EmptyState), Tailwind tokens, a11y baseline | 1d | every primitive renders in a `/dev/ui` gallery at 375/768/1440, is keyboard-reachable with a visible focus ring, and axe reports zero violations on the gallery |
| D1 | WS server package: `ws` + TS, graceful shutdown, structured logging | 1d | the container starts, logs JSON lines, and on SIGTERM closes open sockets and exits 0 |
| D2 | Ticket handshake + **topic authorisation** (channel membership, own user topic) | 1d | connecting with no ticket, a used ticket, or a subscription to a channel the user hasn't joined is rejected before any subscription is created; a user topic can only ever be their own |
| D3 | Connection registry, multi-topic subscriptions, presence tracking | 1d | two tabs of the same user count as one presence entry; disconnect clears it within one heartbeat interval |
| D4 | Redis pub/sub wiring + typed `events.ts` union contract | 1d | `packages/contracts` is imported by web, realtime and worker; a test publishes each variant and a subscriber receives it typed |
| D5 | Client `useRealtime` hook, reconnect w/ backoff, heartbeat | 1.5d | killing the realtime container reconnects with backoff and registers no duplicate handlers, proven in a Playwright test |
| D6 | Optimistic UI + server reconciliation on document and thread mutations | 1d | a rejected optimistic insert rolls back and surfaces an error; an update with a stale `version` shows a conflict prompt rather than overwriting |
| D7 | `worker` container + BullMQ repeatable deadline scan | 1d | the scan runs on schedule and resumes after a Redis restart without losing the repeatable job |
| D8 | Deadline rules: hard 90/60/30, soft 60-day anniversary nudge, periodic interval | 1d | seeded rows at T-91/-90/-61/-60/-31/-30, one anniversary and one periodic interval produce exactly the expected notification set; a second run produces none |
| D9 | Notification centre + WS push + email via Mailpit | 1.5d | a deadline notification and a community notification each appear in the bell, over WS, and (for deadlines) in Mailpit, rendered in the recipient's locale |
| D10 | `next-intl` setup, locale routing, switcher, persistence | 1d | every route lives under `/[locale]`; switching locale preserves the current path; the choice persists to `User.locale` |
| D11 | FR/EN/ES message catalogues, FR date/number formatting | 1.5d | `pnpm i18n:check` reports zero missing and zero orphan keys; French renders `31/12/2026` and `1 234,56 €` |
| D12 | WS resilience testing: reconnect storms, Redis loss, dupes | 1d | 50 simultaneous reconnects plus a Redis restart lose no events and create no duplicate rows |
| D13 | Accessibility + responsive QA pass | 1d | axe reports zero violations on every route at 375/768/1440 and the full upload flow is completable by keyboard only |
| D14 | Profile & settings page: display name, locale, avatar upload, Helper badge, online indicators | 1d | avatar upload replaces the previous object, renders through the authorised file route, and the member list shows live online state |
| **D15** | **Friends: request / accept / decline / block, friends list, live status changes** | **1d** | a request creates one row, accepting is idempotent under a double-click, blocking hides both directions, and each transition pushes over the recipient's user topic |
| **D16** | **Direct messaging: conversation + message persistence, live delivery, unread counts, read receipts** | **1.5d** | two browsers exchange messages with no refresh; unread counts survive a reload; a message to a user who blocked you is rejected server-side |
| **D17** | *(credited to B8)* Extraction correction UI | **1d** | as specified in B8 |

**Domain D total: 19d**

### Domain E — Data, Storage, Community & GDPR (Amir)

| # | Task | Est. | Done when |
|---|---|---|---|
| E1 | Full Prisma schema + initial migration — identity, document inheritance, assistant, community | 2d | `prisma migrate dev` from zero reproduces §3; `prisma validate` passes; generated types compile in web, realtime and worker; every subtype's `id` is both PK and FK |
| E2 | Seed script: 4 users, ~20 documents across every category and status, 3 channels with threads and answers | 0.5d | `pnpm db:seed` produces rows hitting every status, every notification boundary, and a channel with a moderator |
| E3 | `docker-compose.override.yml` + data services (postgres, redis, minio, mailpit), MinIO bucket init and lifecycle policy | 0.5d | all four come up healthy on the internal network; `docker compose port minio 9000` fails on the base file and succeeds with the override |
| E4 | Storage adapter: `putObject`, `getObjectStream`, `deleteObject`, `objectKey` | 1d | all four are covered by tests against a live MinIO container; keys are produced only by `objectKey()` |
| E5 | Upload route: multipart, size/MIME validation, magic-byte sniffing | 1.5d | a renamed `.exe` is rejected by magic bytes; >10 MB is rejected before buffering; the happy path writes the object, the base row and the subtype row in one transaction |
| E6 | Document queries + authorised file route, list + detail, pagination, category filter | 1d | list is owner-scoped in the query itself, not filtered in the component; another user's id 404s; `/api/documents/[id]/file` streams only after `assertCan` |
| E7 | Preview: client-side pre-upload preview + stored thumbnail generation | 1d | the chosen file renders in the browser before it is sent; images and PDFs both produce a stored thumbnail; a generation failure degrades to a placeholder without breaking the list |
| E8 | `subtypes.ts` registry + per-category typed create/edit forms | 1d | adding a category touches only `subtypes.ts` and its message keys; a subtype field rejected by its Zod schema never reaches the database |
| **E9** | **Channels: create / update / delete, join / leave, membership + roles** | **1.5d** | a user joins and leaves idempotently under a double-click (unique constraint, not application checks); deleting a channel with threads is blocked with a clear message |
| **E10** | **Threads, answers, votes, reputation** | **1.5d** | posting, answering and accepting an answer all work; a second vote by the same user updates rather than duplicating; reputation increments in the same transaction as the vote |
| **E11** | **Moderation: hide thread/answer, mute member, moderation log** | **1d** | a MODERATOR hides content in their channel and cannot in another; hidden content disappears for members but remains visible to moderators with a marker; every action writes an `AuditLog` row |
| E12 | GDPR export: ZIP of JSON + original files | 1.5d | the ZIP contains a manifest of every row referencing the user — documents, assistant conversations, threads, answers, messages — plus every original file, delivered through the authorised route |
| E13 | GDPR deletion: email confirmation + cascade verification | 1d | deletion requires an emailed confirmation link; a post-deletion scan finds no rows referencing the user and no orphaned MinIO objects; authored community content is anonymised rather than orphaned |
| E14 | Privacy Policy + Terms of Service pages | 0.5d | both exist in all three locales, are reachable logged-out, and the policy names the third-party AI processor, what document data leaves the server, retention, community content handling, and how to exercise export and deletion |
| E15 | DB integrity: constraint tests, migration replay from scratch, index tuning | 1d | `docker compose down -v` → up → migrate → seed → smoke passes in nightly CI |
| E16 | Renewal action links (ANTS, service-public, ameli) per category | 0.5d | each HARD category maps to a real portal URL shown on the document detail and in the notification email, localised |

**Domain E total: 17d**

**Capacity:** 68.5 planned person-days against 100 available (4 × 25) — a 31% buffer for
review, integration, meetings and rework, down from 37% before the community layer was added.
Adrien 15.5 · Rasiol 15 · Alexandre 19 · Amir 17. **Alexandre is the tightest**, and he also
owns the shell that everyone else is blocked on in Week 1 — D15/D16 are the designated
descope candidates if Week 3 runs long (see R6).

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
> rendered through the shared shell at `/fr/dashboard`. A WS client connects and receives a
> heartbeat. Every interface in §5 is committed. CI is green on `main`.

### Week 2 — The Vertical Slice

The **only** goal this week is two complete paths working end to end — one per pillar.
Nothing else matters.

| Member | Tasks |
|---|---|
| **Adrien** | B2, B3, B4, B6, B9 · code review turnaround under 4h |
| **Rasiol** | C4, C5, C12 · delete the `AUTH_STUB` path |
| **Alexandre** | D2, D5, D6 |
| **Amir** | E5, E6, E9 |

> **Milestone W2 (Friday) — make-or-break:** **(a)** a user uploads a passport photo → the AI
> extracts type, authority and expiry → base + subtype rows persist → the document appears on
> the dashboard with a derived status → the user asks the assistant a question about it and
> the answer streams token by token. **(b)** two browsers, two accounts, both joined to one
> channel: one posts a thread, **the other sees it appear live with no refresh**. If either is
> not working by Thursday, community depth work stops and the whole team converges.

Milestone (b) is deliberately early: concurrent multi-user support is a *mandatory* graded
requirement, not a module, and discovering in Week 4 that the transport is wrong is fatal.

### Week 3 — Parallel Build-out

| Member | Tasks |
|---|---|
| **Adrien** | B5, B7, B10, A6 · extraction accuracy iteration |
| **Rasiol** | C7, C8, C6 |
| **Alexandre** | D3, D7, D8, D15 |
| **Amir** | E7, E8, E10 |

> **Milestone W3 (Friday):** Google and GitHub sign-in work end to end. Deadline notifications
> fire correctly for seeded near-expiry documents (verified by time-travelled seed data).
> Threads, answers and votes work with reputation accruing. Typed subtype forms accept and
> reject correctly per category.

### Week 4 — Hardening, Compliance, Polish

| Member | Tasks |
|---|---|
| **Adrien** | B11, A7, A9 · Chrome compat + zero-console-error sweep |
| **Rasiol** | C9, C10, C11, C14 |
| **Alexandre** | D9, D11, D16, D17 · every dev supplies their own translation keys by Wednesday |
| **Amir** | E11, E12, E13, E14, E16 |

> **Milestone W4 (Friday) — FEATURE FREEZE.** All 22 module points implemented. Full
> regression pass on latest stable Chrome with a clean console. After this point, only bug
> fixes, tests and documentation are merged.

### Week 5 — Stabilisation & Defence

Monday is a whole-team bug bash against the W4 regression list. Then:

| Member | Tasks |
|---|---|
| **Adrien** | A8 · multi-user concurrency + load test (4+ simultaneous sessions) · PO validation of every module against the subject · rehearse the evaluator walkthrough, once with the network disabled |
| **Rasiol** | C13 · verify `.env` never entered git history · commit-distribution audit (`git shortlog -sne`) · final report + defence slides (PM) |
| **Alexandre** | D12, D13 |
| **Amir** | E15 · backup/restore doc · curated demo dataset |

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
| Prisma schema + generated types | Amir | All three others | W1 D3 | Whole-team schema review on W1 D1 — the inheritance pattern and the community tables both get read out loud before anyone codes against them. Additive-only migrations after W2. |
| `storage/index.ts` + `deriveStatus()` | Amir | Adrien (extraction persistence), Alexandre (status badges) | W1 D3 | Signatures in §5; implementations follow in E4. |
| `subtypes.ts` registry | Amir | Adrien (B3 narrows `subtypeFields` against it) | W2 D1 | Ship the registry with two categories first (IDENTITY, INSURANCE); the rest are additive. |
| Upload + MinIO storage adapter | Amir | Adrien (needs real files for extraction) | W2 D2 | Adrien develops B2–B4 against local fixture files, swaps to `getObjectStream` afterwards. |
| `can()` policy module | Rasiol | Amir (community scoping), Alexandre (topic authz), Adrien (assistant context guard) | W2 D4 | Signature agreed W1 D1; default-deny stub available immediately. |
| WS ticket endpoint | Rasiol | Alexandre (D2 handshake) | W2 D2 | Small and isolated — pull it forward if the session core runs late. |
| Channels + membership (E9) | Amir | The W2 two-browser milestone | W2 D4 | Seeded channels make the demo runnable from W1; E9 replaces the seed dependency before the W2 gate. |

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
| R2 | **AI extraction underperforms on real documents.** Real photos are skewed, glared and cropped. | **High** | Collect real fixtures in Week 1 and build the eval harness *before* the UI. Ship the correction path (B8) as a designed state, not a fallback — a wrong extraction must never be a dead end, which is also why `ACTION_REQUIRED` is a first-class status. |
| R3 | **Week 2 vertical slice slips.** Both pillars depend on it. | **High** | It is the sole W2 objective. Thursday checkpoint: if either path isn't working, all depth work stops and the team converges. |
| R4 | **WebSocket authorisation done naively** — session cookies aren't reliably available at upgrade, and a client-declared topic leaks another user's DMs or a private channel. | **High** | Short-lived single-use ticket minted by an authenticated route handler (C12), exchanged on connect. Topic rights resolved server-side from the session and `ChannelMembership`; a user topic is only ever the connecting user's own. **Never** trusted from the client. |
| R5 | **Concurrency correctness is explicitly graded.** | Med | Enforce at the database, not in application code: `@@unique([documentId, kind])` on deadline notifications, `@@unique` on `Vote` and `ChannelMembership`, transactions for multi-row writes, `version` column for optimistic concurrency. Scripted 4-browser concurrent test in W5. |
| R6 | **22 points and two pillars in 5 weeks.** The buffer fell from 37% to 31% when the community layer replaced the analytics dashboard, and Alexandre is at 19 days. | **High** | Hard W4 freeze. Pre-agreed drop order if behind: (1) D16 direct messaging → threads-only community, keeping the User-interaction major intact via profiles + friends + channel replies, (2) Spanish → FR/EN, costing 1 point, (3) periodic deadline type → HARD/SOFT only. **Never drop a major** — the seven majors are 14 of the 22 points, and 14 is the pass line on its own. Remember the +5 bonus cap: dropping from 22 to 19 costs *nothing*. |
| R7 | **AI cost is now recurring, not one-shot.** Extraction is bounded by uploads; the assistant is an open-ended chat with document text in every prompt. | **Med** | Checksum cache on extraction, per-user daily extraction cap (B7) *and* hourly assistant message cap (B11), fixtures in CI instead of live calls, one shared key held by Adrien with a billing alert. Track spend weekly from `DocumentExtraction` and `AssistantMessage` token columns. |
| R8 | **Uneven commit distribution**, which the subject grades directly. | Med | No long-lived branches. Every member merges a PR to `main` at least 3× per week. Rasiol audits `git shortlog -sne` at each Friday integration and raises it immediately, not in Week 5. |
| R9 | Self-signed cert produces Chrome warnings, violating the clean-console requirement. | Low | `mkcert` local CA, documented in the README so evaluators can reproduce it. |
| R10 | **The live AI call fails during the defence** — no network in the evaluation room, an expired key, or a rate limit. Both the extraction and the assistant die in front of the evaluators. | **Med** | `DEMO_MODE=1` replays committed fixture extractions and a canned assistant stream with simulated delay, exercising the same code path from `extractDocument()` and `streamAssistant()` down. Rehearse the walkthrough at least once with the network disabled (W5). |
| R11 | **`mespapiers.local` needs an `/etc/hosts` entry and `mkcert -install` needs sudo** — neither may be available on the evaluation machine. | **Med** | Issue the cert for `localhost` as well. Provide `make hosts` and put both the hosts line and the `mkcert -install` command at the top of the README. Test the fallback on a machine that has never run the project. |
| **R12** | **The community holds user-written content about personal administrative situations.** Someone will paste a *titre de séjour* number or a full address into a public thread, on an app that also stores identity documents — a real privacy problem and an awkward one to explain at a GDPR-module evaluation. | **Med** | Moderation shipped as a first-class feature, not an afterthought (E11): hide + mute + audit log. A visible warning on the thread composer that channels are public. Thread and answer bodies are included in the GDPR export and anonymised on deletion (E12, E13). The Privacy Policy states explicitly that community content is public and separate from the private vault. |
| **R13** | **The assistant states a market price as fact and is wrong.** Model knowledge of French insurance pricing is approximate and dated; presenting it as authoritative is misleading and hard to defend. | **Med** | Comparison answers are persisted as `kind = COMPARISON` and always render with an indicative-figure disclaimer that cannot be suppressed by model output (B10, §0). If accuracy matters more than simplicity, add a web search tool to the same interface and cite the retrieved source in the answer. |

---

## 11. Verification

**Per-PR (automated):** `tsc --noEmit`, ESLint, `prisma validate`, migration drift check,
`check:env`, `i18n:check`, Vitest units, `next build`, `docker compose build`.

**Weekly (at Friday integration, manual):**

1. `git clone` fresh → `cp .env.example .env` → `docker compose up` → app reachable over
   HTTPS with no console errors.
2. Sign up → log in → log out → log back in.
3. Upload a real document → confirm extracted type/authority/expiry against the actual paper →
   confirm the typed subtype fields landed in the right table.
4. Ask the assistant a question about that document → confirm it streams progressively and the
   answer references the real content.
5. Open two browsers as two accounts in one channel → post in one → confirm the other updates
   live without a refresh.
6. Log in as a second user → confirm the first user's documents are neither visible nor
   reachable by direct URL, **nor by direct file URL, nor by passing their `documentId` to the
   assistant endpoint**.
7. Open the Chrome network tab across the whole flow → confirm every request goes to
   `mespapiers.local` and none to a container hostname.

**Week 5 acceptance:**

- **Concurrency:** 4 browsers, simultaneous document edits, simultaneous votes on one answer,
  simultaneous joins to one channel. Verify no duplicate notifications, no double votes, no
  duplicate memberships, no lost updates, and that a stale-`version` edit is rejected with a
  conflict rather than silently overwriting.
- **Notifications:** seed documents at T-91, T-90, T-61, T-60, T-31, T-30 days, one contract
  anniversary and one periodic interval. Run the worker. Verify exactly one notification per
  `(document, kind)` — then run it again and verify nothing new is sent.
- **Permissions:** run the truth table live — a MEMBER, a MODERATOR of channel X, and an ADMIN
  each attempt hide/mute/delete in channel X and channel Y. Verify the moderator's power stops
  at their channel boundary and a Helper-badge user has none.
- **Migration replay:** drop the volume, `prisma migrate deploy` from zero, seed, smoke test.
- **GDPR:** request an export, confirm the ZIP contains documents, assistant conversations and
  community content plus original files; request deletion, confirm the email step, verify the
  cascade leaves no orphaned rows or MinIO objects and that authored community content is
  anonymised rather than dangling.
- **i18n:** walk every screen in FR, EN and ES. No missing keys, no layout breakage.
- **Console:** every route in latest stable Chrome, zero warnings and zero errors.
- **Offline demo:** run the full walkthrough with `DEMO_MODE=1` and the network disabled.
- **Cold machine:** clone onto a machine that has never run the project, follow the README,
  reach the dashboard — including the `https://localhost` fallback path.
