# MesPapiers: Project Blueprint

> **Scope note.** This document supersedes the earlier household-sharing version of the
> vision. MesPapiers is now an **individually-owned** document vault with an AI assistant,
> surrounded by a **mutual-aid community**. There is no shared family workspace and no
> analytics dashboard. The execution counterpart of this document is
> [`project_plan.md`](project_plan.md); where the two disagree, they must be reconciled before
> the week's planning, not during evaluation.

---

## 1. Project Vision (Detailed)

**The Pain:**
French administrative paperwork (*la paperasse*) is historically fragmented across physical
drawers, emails, and dozens of disconnected digital portals (Préfecture, CAF, Ameli, ANTS,
insurance providers). There is no single source of truth. Missing a renewal deadline for
critical documents — a passport, a national ID card, a residency permit (*titre de séjour*),
a mandatory vehicle inspection (*contrôle technique*) — costs real money, causes severe
administrative blockages, and can jeopardise legal residency status.

Two further pains sit on top of that first one, and they are what shape this product:

- **Nobody knows whether they are getting a fair deal.** Insurance policies, health plans and
  utility contracts renew themselves silently every year. The risk is not losing cover — it is
  paying above market rate indefinitely because nothing ever prompts a comparison.
- **Some questions are not answerable from your own documents at all.** "Which form does the
  préfecture actually want this year?" "How long did your renewal take?" These are answered by
  people who have just been through the same procedure, not by a database.

For non-native speakers, all three of these compound: the language barrier sits on top of the
procedural one, and the stakes (residency status) are the highest.

**The Target:**
Individuals residing in France managing their own administrative paperwork, with a specialised
focus on **non-French-speaking residents and expatriates**, where the stakes of missing
deadlines and the language barrier are significantly higher. Documents are private to their
owner; what is shared between people is knowledge, not paperwork.

**The Vision:**
MesPapiers answers two different kinds of "I don't know what to do here" — the kind the data
can answer, and the kind only another person can.

It transforms static document images into live, typed, actionable objects that monitor hard
legal deadlines to prevent fines and legal risk, and surface soft financial deadlines to
prevent passive overpayment. On top of that vault sits a conversational assistant that reads
your own documents and answers questions about them. And around both sits a community of
people navigating the same administration, organised into topic channels where experience is
pooled rather than re-discovered alone.

---

## 2. Project Solution with Steps

### Pillar 1 — The Paperwork Assistant

**Step 1: Smart Capture & AI Extraction**
The user photographs or uploads a document. Instead of forcing manual data entry, the system
processes the image through an AI vision model that reads and extracts the document type, the
issuing authority, and the critical expiration or contract renewal date, returning a strictly
typed JSON response rather than free text.

**Step 2: Typed Object Creation**
The scan is not merely saved as a flat file — it becomes a structured object with a **real
type**. A base document record holds what every document has (owner, category, file, dates,
deadline behaviour); a typed subtype record holds what only that category has. An insurance
contract carries an insurer, a policy number, a premium and an anniversary date; an identity
document carries a holder name and a document number. These are typed database columns, not a
bag of JSON, so the system can actually reason and query over them.

When the AI's confidence is low, the document lands in an explicit **Action Required** state
on a review screen where every field — base and typed — is editable. A wrong extraction is a
designed state, never a dead end.

**Step 3: Personal Document Dashboard**
All processed documents populate a single dashboard giving one clear view of every document's
status, visually colour-coded: **Valid · Expiring Soon · Expired · Action Required**. Status
is never stored — it is derived at read time from the deadline date, the deadline type and the
extraction state, so the dashboard can never contradict the notification engine.

**Step 4: Dual-Logic Smart Notifications**
The application deploys distinct alert behaviours based on the nature of the deadline:

- **Hard deadlines (legal / identity):** for passports, ID cards, residency permits and
  vehicle inspections, fixed escalating alerts at **90, 60 and 30 days** before expiry, with
  direct links to the relevant government portal (ANTS, service-public, ameli).
- **Soft / tacit renewals (contracts, insurance):** the risk is financial, not a loss of
  service, so instead of an expiry countdown the system issues an annual nudge **60 days**
  before the contract anniversary, prompting renegotiation or comparison. A soft renewal never
  displays as *Expired* — that would be factually wrong.
- **Periodic declarations:** recurring obligations (quarterly CAF declarations and similar)
  are reminded on their own interval. Like soft renewals, a missed one is re-declared, not
  lost.

**Step 5: The AI Assistant**
The user can ask questions about their own documents in a streaming chat — "what does this
say", "when does this expire", "what do I need to renew it" — and push further into
comparison: *"is what I'm paying for this insurance reasonable?"*

The selected document's extracted text is passed directly into the model's context. There is
no retrieval database and no maintained pricing dataset (see §7 — this is a deliberate
decision, not an omission). Comparison answers are always presented as **indicative**, with
the basis of the comparison stated and a visible disclaimer that they are not financial
advice. A figure the model is uncertain about must never render as an authoritative number.

### Pillar 2 — The Mutual-Aid Community

**Step 6: Topic Channels, Answers and Direct Contact**
Users join topic channels — *titre de séjour*, *assurance auto*, CAF, and so on — where they
post real questions and are answered by people who have been through the same procedure.
Useful answers are voted on, which accrues **reputation** and surfaces reliable contributors
as **Helpers**. A user can message an individual helper directly, add them as a contact, and
build a small trusted network over time.

Because this is public content on personal administrative topics, moderation is a first-class
feature rather than an afterthought: per-channel moderators can hide content and mute members,
every moderation action is logged, and the composer warns explicitly that channels are public.

**A hard boundary between the two pillars:** nothing from a user's document vault ever reaches
the community layer. The assistant's context is assembled server-side from documents the
requesting user owns, and no document content is ever echoed into a channel, a thread or a
direct message by the system.

---

## 3. Roles & Permissions

Permissions resolve in three tiers, in order. Anything not explicitly granted is denied.

| Role | Assigned how | Can do |
|---|---|---|
| **Member** | Default on signup | Full control of their own documents and assistant. Join/leave channels, post questions and answers, vote, message contacts, add friends. |
| **Helper** | **Earned** — reputation threshold | Identical permissions to Member. The badge is recognition only. |
| **Moderator** | Assigned per channel by an Admin | Everything a Member can do, plus hide threads and answers and mute members **inside that one channel**. |
| **Admin** | Global | User CRUD, promote and demote moderators, moderate anywhere. |

Two design decisions worth defending out loud:

- **Helper grants no power.** Reputation is earned by being useful, and if it also granted
  moderation authority it would become a target to farm. Recognition and authority are kept
  deliberately separate.
- **Moderator authority stops at the channel boundary.** A moderator of *assurance auto* has
  no power in *titre de séjour*. This is what makes the permissions system a real system
  rather than a three-value enum.

Document permissions are simpler by design: a document belongs to exactly one user, and no
role — moderator or admin — can read another user's vault. This is checked at the server
action, the list query, the file route **and** the assistant endpoint, because an authorisation
check that exists on three of four paths is a hole, not a system.

---

## 4. Technical Architecture

The platform is 100% TypeScript, containerised end to end.

- **Language:** TypeScript (end-to-end type safety)
- **Frontend:** Next.js 15 (App Router, React) + Tailwind CSS
- **Backend / API:** Next.js Server Actions & Route Handlers (including the assistant SSE
  stream) + a dedicated Node.js WebSocket engine
- **Database:** PostgreSQL 17
- **ORM:** Prisma (type-safe queries and migrations)
- **Object storage:** MinIO (S3-compatible), internal network only
- **Real-time broker:** Redis Pub/Sub
- **Background jobs:** dedicated worker container (BullMQ) for the deadline scan
- **Infrastructure:** Docker Compose + NGINX (HTTPS reverse proxy)
- **AI:** Anthropic `claude-opus-5` for both vision extraction and the assistant
- **i18n:** `next-intl` — French, English, Spanish

**Architecture Map:**

```text
                              [ Browser (Chrome) ]
                                       |
                           [ NGINX (HTTPS Reverse Proxy) ]
                                       |
                 +---------------------+---------------------+
                 |                                           |
   [ Next.js Web Application ]               [ Node.js WebSocket Engine ]
   (UI · Server Actions · file route          (channels · direct messages ·
    · assistant SSE stream)                    presence · notification push)
                 |                                           |
                 |          [ Worker container ]             |
                 |          (deadline scan cron)             |
                 +---------------------+---------------------+
                                       |
          +----------------+-----------+-----------+----------------+
          |                |                       |                |
   [ PostgreSQL ]     [ Redis Pub/Sub ]       [ MinIO ]       [ Mailpit ]
   (Prisma state)     (real-time bus)       (document files)   (dev mail)
```

**Two transport decisions.** The assistant streams over **SSE from a Next.js route handler**,
not over the WebSocket engine: it is a single-user, unidirectional token stream to a browser
that is already authenticated on the HTTP request, with no fan-out to route. The **WebSocket
engine owns genuine multi-user real-time** — channel events, direct messages, presence and
notification push — which is where broadcast actually happens.

**File access.** MinIO has no host port and is never addressed by the browser. Every file
reaches the user through an authorised route handler that re-checks permission on each
request, rather than through a presigned URL that would bypass the permission system for its
whole lifetime.

---

## 5. Detailed Core Execution Flow

### A. Adding a document

1. **Upload.** The user uploads an image or PDF through the Next.js frontend. The file is
   validated for size and for real type by inspecting its magic bytes, never by trusting the
   declared MIME type.
2. **Storage.** The file is written to MinIO under a key derived from the owner and document
   id; the checksum is recorded so that re-uploading an identical file costs no AI call.
3. **AI extraction.** The backend transmits the file to the AI vision model and requests a
   strictly typed JSON response. The reply is validated against a Zod schema before anything
   touches the database; a malformed response is rejected, never persisted.
4. **Typed persistence.** Prisma writes the base `Document` row and its typed subtype row in a
   single transaction, mapped to the owner and assigned a deadline type (hard / soft /
   periodic). Extraction metadata — model, confidence, token counts — is written to an audit
   table.
5. **Review if needed.** Below the confidence threshold, the document is marked *Action
   Required* and routed to the correction screen rather than being silently trusted.
6. **Dashboard.** The document appears with its derived status. Nothing is broadcast — the
   vault is private to its owner.
7. **Background scheduling.** The worker container scans for upcoming target dates and
   dispatches notifications on the 90/60/30, annual-nudge or periodic logic. A uniqueness
   constraint on `(document, notification kind)` makes the scan safe to run repeatedly: it may
   fire at-least-once, and the database makes the outcome exactly-once.

### B. Asking the assistant

1. The user opens the assistant on a document and asks a question.
2. The backend loads the document, **re-checks that the requesting user owns it**, and only
   then assembles the prompt. A `documentId` arriving from the client is a request, never a
   grant.
3. The model's response streams back token by token over SSE and renders progressively.
4. The exchange is persisted with its token counts. Comparison answers are stored as such, so
   the indicative-figure disclaimer is a property of the data rather than something the UI
   might forget to render.

### C. Community interaction

1. A user posts a thread in a channel they have joined.
2. The web app writes the row and publishes an event to Redis.
3. The WebSocket engine, subscribed to Redis, resolves which connections are subscribed to
   that channel's topic — from the membership table, never from a client-declared room — and
   pushes the update.
4. Every other member viewing the channel sees the thread appear with no refresh. The answer's
   author gets a notification on their own private topic.
5. A moderator hiding content, or an admin promoting a moderator, follows the same path, with
   an audit log row written in the same transaction.

---

## 6. Modules To Implement

Each major module is worth 2 points and each minor 1 point. The project implements
**22 points: 7 majors and 8 minors.**

**On the point budget:** the subject requires **14** and caps the bonus at **+5**, so at most
**19 points can ever count**. The three points above that ceiling are deliberate insurance
against a module failing validation at evaluation — not extra credit. Effort always goes to
making an existing module solid before adding another.

### Major Modules (7 × 2 = 14 points)

**Major: Use a framework for both the frontend and backend.**
- **Application:** Next.js (App Router) with Server Components, Server Actions and Route
  Handlers managing React UI and backend logic in one unified TypeScript codebase.

**Major: Implement real-time features using WebSockets.**
- **Application:** The community layer. A dedicated Node.js WebSocket engine, fed by Redis
  Pub/Sub, pushes new threads, answers, votes, moderation actions, direct messages, presence
  changes and notifications to every relevant connected client with no refresh.

**Major: Standard user management and authentication.**
- **Application:** Accounts, profiles, avatars, locale preference, the Helper reputation
  badge, a friends system and live online status.

**Major: Allow users to interact with other users.**
- **Application:** The entraide layer's human side — one-to-one direct messaging with
  persistence, unread counts and read receipts, user profiles, and friend requests with accept
  / decline / block.

**Major: Advanced permissions system.**
- **Application:** The Member / Helper / Moderator / Admin model of §3 — default-deny,
  three-tier resolution, channel-scoped moderation, a global admin surface for user CRUD and
  role assignment, and an audit log behind every privileged action.

**Major: An organization system.**
- **Application:** Community channels are organisations: created, edited and deleted, joined
  and left, with per-organisation membership roles governing what each member may do inside
  them.

**Major: Implement a complete LLM system interface.**
- **Application:** The document assistant. Streaming responses token by token over SSE,
  per-user rate limiting, and explicit handling of upstream failures — timeout, refusal, rate
  limit — each surfaced as a distinct translated message rather than a generic error.

### Minor Modules (8 × 1 = 8 points)

**Minor: Use an ORM for the database.**
- **Application:** Prisma throughout, including the class-table inheritance pattern that gives
  each document category its own typed table sharing a primary key with the base document row.

**Minor: Image recognition and tagging system.**
- **Application:** The vision OCR pipeline that reads a photographed document and classifies
  it — type, issuing authority, dates — turning an image into a categorised, tagged object
  with a confidence score and a human review path below threshold.

**Minor: File upload and management system.**
- **Application:** Secure handling of sensitive PDFs and images: size and format validation,
  magic-byte type verification, MinIO storage, thumbnail generation, in-browser preview before
  upload, and authorised streaming on download.

**Minor: A complete notification system.**
- **Application:** The dual-logic engine — hard deadlines at 90/60/30 days, annual nudges for
  tacit renewals, periodic declaration reminders — plus community notifications for answers,
  messages and friend requests, delivered in-app, over WebSocket and by email.

**Minor: Support for multiple languages (at least 3).**
- **Application:** `next-intl` with full UI translation in French, English and Spanish,
  locale-prefixed routing, a switcher that preserves the current path, persistence to the user
  profile, and French date and number formatting. Critical for the target demographic — this
  is a product requirement that happens to also be a module.

**Minor: Implement remote authentication with OAuth 2.0.**
- **Application:** Google and GitHub sign-in via hand-rolled authorization-code flow with
  PKCE, including account linking when an email already exists with a password.

**Minor: Implement a complete 2FA system.**
- **Application:** TOTP enrollment with QR, verification with drift tolerance, single-use
  recovery codes, and step-up re-verification before destructive actions. Justified directly
  by the fact that the app stores identity documents.

**Minor: GDPR compliance features.**
- **Application:** Data export as a ZIP containing every row referencing the user — documents,
  assistant conversations, threads, answers, messages — alongside the original files; and
  permanent deletion behind an email confirmation, cascading to MinIO objects, with authored
  community content anonymised rather than left dangling.

---

## 7. Deliberately Out of Scope

Recorded here because each of these was considered and rejected for a reason, and each will be
asked about.

**A RAG / retrieval system.** The subject's RAG module requires proper context retrieval over
a large dataset. At personal scale — a few dozen documents, each a page or two of text — there
is nothing to retrieve: the relevant document is already known. Building embeddings and a
vector store to search a corpus that fits in one context window would be architecture theatre,
and a retrieval step that does not retrieve scores zero. The assistant passes document text
directly into the prompt, and the LLM interface module is claimed on its streaming, rate
limiting and error handling — which are genuinely implemented.

**A maintained market-price dataset.** Price comparison relies on the model's own knowledge,
labelled indicative, rather than on a curated dataset the team would have to build and keep
current for five weeks. If accuracy ever matters more than simplicity, the upgrade path is a
web search tool inside the same LLM interface — not a second module.

**Household / family sharing.** Shared vaults, member invitations and household RBAC were the
earlier concept. They were dropped in favour of individual ownership plus a community: the
sharing people actually need is knowledge about procedures, not access to each other's
identity documents.

**An analytics dashboard.** It served the household concept — an administrator surveying a
family's administrative health. With individual ownership the dashboard has a handful of rows
to visualise, which is a list, not an analytics product. Its two points went to the community
modules, which the product actually needs.

**Right-to-left language support.** Out of scope for the three shipped locales, but the UI is
built with Tailwind logical properties throughout so that adding Arabic later stays cheap.
