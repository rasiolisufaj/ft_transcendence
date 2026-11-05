# Expiry notifications (D7, HARD deadlines only): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a document with a legal expiry date (an ID card, a passport) is within 90 days of expiring, or has expired, its owner gets one notification in the bell for each of those two moments. The notification arrives live and opens the document.

**Architecture:** One pure rule, `expiryStatus()`, in `src/lib/documents/status.ts`, the file plan §5 reserves for `deriveStatus()`. A `worker` process (the same image, a third compose service) runs `scanDeadlines()` every minute. The scan inserts one `Notification` per `(document, type)` with `skipDuplicates`, and a new `@@unique([documentId, type])` makes a second run a no-op even when two scans overlap. The bell, the `/notifications` page and their links reuse Alexandre's notification code: a deadline row carries a `documentId` and gets its text (the file name, the date) at read time in the reader's locale, like every other notification.

**Tech Stack:** Prisma 6.19 (`createManyAndReturn` with `skipDuplicates`), Vitest, next-intl 4, `tsx` for the worker, Docker Compose.

**Spec:** [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) §5 *Status derivation* (rule 2: `HARD`, `EXPIRING_SOON` within 90 days, `EXPIRED` past the date), §7 D7–D9, risk R5 (idempotent at the database). Cut to HARD expiry only with Rasiol on 2026-11-04 (see *Keep vs. Cut*).

## Global Constraints

- **Owners first.** D7–D9 are Alexandre's, `src/lib/documents/` and `prisma/` are Amir's, and compose is Adrien's (plan §4, §7). Agree with the team on who builds this before Task 1. Each owner reviews their files in the PR.
- Branch `feat/expiry-notifications`, cut from `main` (`fd8f4a1`).
- One task per request. Before a task: say what it does. After it: say how to test it. **No commit without Rasiol's go-ahead.**
- No new dependency. One migration. New message keys only under `notifications.*`, in fr, en and es (es uses *usted*, PR #52).
- `npm run lint` 0/0, `npm run i18n:check` clean, `npm run build` then `npm run typecheck` 0 when the plan is done.
- DB tests need `db` up and migrated. If `npm test` is killed (exit 137), run `npx vitest run --maxWorkers=1`. If every DB test fails with *could not locate the Query Engine*, see `CLAUDE.md` → *Prisma engine flips*.
- Browser checks on `https://mespapiers.local:8443`.

## Decisions

1. **HARD only.** An insurance renewal (`SOFT`) or a declaration (`PERIODIC`) does not expire, and `PERIODIC`'s interval is not even stored. Both are left to `deriveStatus()`.
2. **Two notifications, no more.** `DEADLINE` once the date is 90 days away or less, `DEADLINE_PASSED` once it has passed. A document uploaded already expired gets only `DEADLINE_PASSED`. `DEADLINE` already exists in `NotificationType` and nothing writes it; the migration adds `DEADLINE_PASSED`. Adding an enum value is a plain `ADD VALUE`, while renaming or removing one makes Prisma rebuild the type.
3. **A document is valid through its expiry day.** Upload stores the printed day at midnight UTC ([`actions.ts:88-89`](../../src/app/[locale]/(app)/documents/new/actions.ts)), so the document is `EXPIRED` from midnight UTC the next day, which is 01:00 or 02:00 in Paris. That hour or two of skew is accepted.
4. **`NEEDS_REVIEW` documents are notified too.** There is no review screen (B8 is not started), so leaving them out would silence them forever. A date the model doubted is still the best date there is, and the notification opens the page that shows it.
5. **Idempotent in the database, not in code.** `@@unique([documentId, type])` plus `skipDuplicates` (`ON CONFLICT DO NOTHING`). `NULL`s are distinct in a Postgres unique index, so community notifications, which have no `documentId`, never collide. The plan's `[documentId, kind]` is `[documentId, type]` here: `type` is the kind.
6. **`documentId` cascades.** Deleting a document deletes its notifications, so a notification never opens a 404.
7. **Text at read time.** `content` holds ids, never text (the comment at the top of `notifications.ts`). A deadline row stores `"{}"` and gets its `documentId` as a column. `views.ts` renders the file name and the date in the reader's locale.
8. **The worker:** `src/worker/main.ts` runs the loop and `src/worker/scan.ts` holds the scan, the same split as `src/realtime/main.ts`, so the test imports the scan without starting the loop (the plan's command was `tsx src/worker/scan.ts`). It scans every minute, so a freshly uploaded ID is notified within a minute. It has no shutdown handler: stopping mid-scan loses nothing, because the next run redoes it. `sh` is PID 1 in the container, so Node exits on `SIGTERM` by default.

## Keep vs. Cut (2026-11-04)

The draft was checked line by line against the case *"I upload an ID with an expiry date and get a notification that it expires soon"*.

| Draft item | Verdict | Why |
|---|---|---|
| `expiryStatus()` + `EXPIRING_SOON_DAYS` in `status.ts` | **Keep** | It is the check. It's pure, it's tested at its boundaries, and it sits in the file `deriveStatus()` will wrap. |
| Full `deriveStatus()` (`SOFT` anniversary, `PERIODIC`, `ACTION_REQUIRED`) | Cut | Not expiry. `PERIODIC` has no stored interval. Amir's. |
| Status badge on the document page and dashboard; expired documents kept on the dashboard | Cut | Display. The notification opens the document page, which already shows the date. |
| 90/60/30-day escalation (D8) | Cut | One warning before and one after cover the case. |
| A second kind, `DEADLINE_PASSED` | **Keep** | Without it, an ID uploaded already expired would be told it "expires soon", and the day it lapses goes unannounced. Cost: one enum value and one string. |
| Migration: `Notification.documentId` (cascade) + `@@unique([documentId, type])` | **Keep** | R5's idempotency, and a deleted document takes its notifications with it. |
| Replacing `DEADLINE` with two new enum values | Cut | Reuse `DEADLINE` and add one value. Removing a value makes Prisma rebuild the type and ask for confirmation. |
| `worker` process + compose service | **Keep** | Nothing else runs on a timer, and the plan keeps timers out of Next (render workers, dev restarts). |
| Running the scan inside the `realtime` process | Cut | That's Alexandre's socket server, and it's a separate concern. |
| Live push to the bell (`publish`) | **Keep** | One call. The bell already refreshes on `notification.created`. |
| Email through Mailpit (D9) | Cut | `User.locale` is never written, so the mail's language is unknown. The case asks for a notification. |
| Notifying right after upload | Cut | The one-minute scan covers it. |
| Graceful shutdown, an env setting for the interval or the threshold | Cut | The scan is idempotent. The values are constants. |
| Skipping already-notified documents in the query | Cut | Marked `ponytail:` in `main.ts`. |
| Leaving out `NEEDS_REVIEW` documents | Cut | Decision 4. |
| New seed data | Cut | The seed already has expired IDs (`rasiol@`, `maria.garcia@`) and expiring ones (`fatima.ben.ali@`, `sarah@`). |
| `npm run worker` | **Keep** | One line, like `npm run realtime`, for running the worker on the host. |

## Review Focus

- An ID marked *valable jusqu'au 15/03* is not expired on 15 March. *Task 1 test*
- Running the scan twice, or two scans at once, never sends a second notification for the same document and kind. *Task 2 test + the unique index*
- An ID uploaded already expired says *a expiré*, never *expire bientôt*. *Task 2 test*
- Deleting the document removes its notification, so the bell never opens a 404. *Task 2 test*
- An insurance renewal (`SOFT`), a document with no expiry (`NONE`), or a date the AI could not read gets no expiry notification. *Task 2 test*

## Not in this plan (follow-ups for the team)

- `deriveStatus()` and the status badges (Amir, Alexandre). Its `HARD` branch should call `expiryStatus()`.
- The `SOFT`/`PERIODIC` reminders and the 90/60/30 escalation (D8).
- The deadline email (D9), once `User.locale` is written (D10).
- The dashboard's *upcoming* list drops a document the moment it expires (`targetDate >= now`).

## Files

| File | Change | Task |
|---|---|---|
| `src/lib/documents/status.ts`, `status.test.ts` (new) | `expiryStatus()`, `EXPIRING_SOON_DAYS`, `DAY_MS` | 1 |
| `prisma/schema.prisma` + one migration | `DEADLINE_PASSED`, `Notification.documentId`, the unique index | 2 |
| `src/worker/scan.ts`, `scan.test.ts` (new) | `scanDeadlines()` | 2 |
| `src/lib/notifications/notifications.ts`, `notifications.test.ts` | the document in `withNames()`, its link in `notificationHref()` | 3 |
| `src/lib/notifications/views.ts`, `views.test.ts` | the two texts | 3 |
| `messages/{fr,en,es}.json` | `notifications.deadline`, `notifications.deadlinePassed` | 3 |
| `src/worker/main.ts` (new), `package.json`, `docker-compose.yml` | the loop, `npm run worker`, the `worker` service | 4 |
| `CLAUDE.md`, `handoff/WORKLOG.md`, `PROJECT_PLAN.md` | state | 4 |

---

### Task 1: The rule

**What it does:** a pure function that says where a HARD deadline stands today. No database, no UI.

**Files:**
- Create: `src/lib/documents/status.ts`
- Test: `src/lib/documents/status.test.ts`

**Interfaces:**
- Produces: `DAY_MS: number`, `EXPIRING_SOON_DAYS = 90`, `type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED"`, `expiryStatus(targetDate: Date, now?: Date): ExpiryStatus`

- [ ] **Step 1: Branch and baseline**

```bash
git switch main && git pull && git switch -c feat/expiry-notifications
npx vitest run --maxWorkers=1
```
Expected: all green. Write the count down; later tasks compare against it.

- [ ] **Step 2: Write the failing test**

`src/lib/documents/status.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DAY_MS, EXPIRING_SOON_DAYS, expiryStatus } from "@/lib/documents/status";

// As upload stores it: the printed day at midnight UTC.
const EXPIRY = new Date("2027-03-15T00:00:00Z");
const daysBefore = (days: number) => new Date(EXPIRY.getTime() - days * DAY_MS);

describe("expiryStatus", () => {
  it("is VALID more than 90 days ahead", () => {
    expect(expiryStatus(EXPIRY, daysBefore(EXPIRING_SOON_DAYS + 1))).toBe("VALID");
  });

  it("is EXPIRING_SOON from 90 days ahead", () => {
    expect(expiryStatus(EXPIRY, daysBefore(EXPIRING_SOON_DAYS))).toBe("EXPIRING_SOON");
  });

  it("is still EXPIRING_SOON on the expiry day itself", () => {
    expect(expiryStatus(EXPIRY, new Date("2027-03-15T18:00:00Z"))).toBe("EXPIRING_SOON");
  });

  it("is EXPIRED once the expiry day is over", () => {
    expect(expiryStatus(EXPIRY, new Date("2027-03-16T00:00:00Z"))).toBe("EXPIRED");
    expect(expiryStatus(EXPIRY, new Date("2030-01-01T00:00:00Z"))).toBe("EXPIRED");
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/lib/documents/status.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/documents/status"`.

- [ ] **Step 4: Write the rule**

`src/lib/documents/status.ts`:
```ts
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A HARD document warns this many days before it expires (PROJECT_PLAN §5, rule 2). */
export const EXPIRING_SOON_DAYS = 90;

export type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED";

/**
 * Where a HARD deadline stands. `targetDate` is the printed expiry day at midnight
 * UTC, as upload stores it, and the document is still valid during that day.
 * deriveStatus() (plan §5, not built yet) should call this for its HARD branch.
 */
export function expiryStatus(targetDate: Date, now: Date = new Date()): ExpiryStatus {
  const daysLeft = (targetDate.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft <= -1) {
    return "EXPIRED";
  }
  if (daysLeft <= EXPIRING_SOON_DAYS) {
    return "EXPIRING_SOON";
  }
  return "VALID";
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run src/lib/documents/status.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Mutation check**

Change `daysLeft <= -1` to `daysLeft < 0` and run the test again. *is still EXPIRING_SOON on the expiry day itself* must fail. Then put the line back.

- [ ] **Step 7: Commit (with Rasiol's go-ahead)**

```bash
git add src/lib/documents/status.ts src/lib/documents/status.test.ts
git commit -m "feat(documents): expiryStatus, the HARD deadline rule"
```

---

### Task 2: The migration and the scan

**What it does:** gives a notification a document and a unique key, then writes the function that creates the notifications. Nothing calls it yet.

**Files:**
- Modify: `prisma/schema.prisma` (`enum NotificationType`, `model Notification`, `model Document`)
- Create: `prisma/migrations/<timestamp>_expiry_notifications/migration.sql` (generated)
- Create: `src/worker/scan.ts`
- Test: `src/worker/scan.test.ts`

**Interfaces:**
- Consumes: `DAY_MS`, `EXPIRING_SOON_DAYS` and `expiryStatus()` from Task 1; `publish()` from `src/lib/realtime/publish.ts` (logs, never throws).
- Produces: `NotificationType.DEADLINE_PASSED`, `Notification.documentId: number | null`, `scanDeadlines(now?: Date): Promise<number>` (how many notifications it created).

- [ ] **Step 1: Edit the schema**

In `enum NotificationType`, add one value under `DEADLINE`:
```prisma
enum NotificationType {
  DEADLINE
  DEADLINE_PASSED
  REPLY
  MESSAGE
  FRIEND_REQUEST
  OTHER
}
```

In `model Notification`, add the column, the relation and the unique key:
```prisma
model Notification {
  id          Int              @id @default(autoincrement())
  recipientId String           @map("recipient_id")
  type        NotificationType
  content     String           @db.VarChar(255)
  isRead      Boolean          @default(false) @map("is_read")
  documentId  Int?             @map("document_id")
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @default(now()) @updatedAt @map("updated_at")

  recipient User      @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  document  Document? @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, type])
  @@index([recipientId])
}
```

In `model Document`, under `insuranceAuto DocumentInsuranceAuto?`, add the back-relation:
```prisma
  notifications Notification[]
```

- [ ] **Step 2: Create and apply the migration**

If the host's Prisma client was last generated by the `web` container, fix it first (`CLAUDE.md` → *Prisma engine flips*): `docker exec mespapiers_web chown -R $(id -u):$(id -g) /app/src/generated`.

```bash
npm run db:migrate -- --name expiry_notifications
```
Prisma warns that the unique constraint fails on duplicate values and asks to confirm. Answer `y`: the `document_id` column is new, so no duplicate can exist. An agent's shell cannot answer that prompt, so Rasiol runs this one command in his own terminal.

Read the generated `migration.sql`. It must contain exactly these four changes, and no `DROP`:
- `ALTER TYPE "NotificationType" ADD VALUE 'DEADLINE_PASSED';`
- `ALTER TABLE "Notification" ADD COLUMN "document_id" INTEGER;`
- `CREATE UNIQUE INDEX "Notification_document_id_type_key" ON "Notification"("document_id", "type");`
- a foreign key `Notification_document_id_fkey` to `"Document"("id")` with `ON DELETE CASCADE`

The `web` container now answers 500 until it is restarted. Leave it alone until Task 4: restarting it flips the host's client back.

- [ ] **Step 3: Write the failing test**

`src/worker/scan.test.ts`:
```ts
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeadlineType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DAY_MS } from "@/lib/documents/status";
import { publish } from "@/lib/realtime/publish";
import { scanDeadlines } from "@/worker/scan";

vi.mock("@/lib/realtime/publish", () => ({ publish: vi.fn() }));

// The scan reads every user's documents, so it also notifies the seeded ones, exactly as
// the running worker would. That is why `now` stays real here: a frozen future date
// would leave them wrong notifications.
let owner: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Owner" },
  });
  owner = user.id;
});

afterEach(async () => {
  // Cascades the documents and their notifications.
  await prisma.user.deleteMany({ where: { id: owner } });
  vi.mocked(publish).mockReset();
});

async function createDocument(deadlineType: DeadlineType | null, daysLeft: number | null) {
  const document = await prisma.document.create({
    data: {
      ownerId: owner,
      fileName: "carte.pdf",
      fileType: "application/pdf",
      fileSize: 1,
      fileData: Buffer.from("x"),
      fileHash: randomUUID(),
      deadlineType,
      targetDate: daysLeft === null ? null : new Date(Date.now() + daysLeft * DAY_MS),
    },
  });
  return document.id;
}

const mine = () =>
  prisma.notification.findMany({
    where: { recipientId: owner },
    orderBy: [{ documentId: "asc" }, { id: "asc" }],
    select: { documentId: true, type: true },
  });

describe("scanDeadlines", () => {
  it("tells the owner about an ID that expires soon, and about one that has expired", async () => {
    const soon = await createDocument("HARD", 30);
    const expired = await createDocument("HARD", -10);

    await scanDeadlines();

    expect(await mine()).toEqual([
      { documentId: soon, type: "DEADLINE" },
      { documentId: expired, type: "DEADLINE_PASSED" },
    ]);
  });

  it("leaves alone what is not an expiry, or not yet", async () => {
    await createDocument("HARD", 200);
    await createDocument("SOFT", 30);
    await createDocument("NONE", null);
    await createDocument("HARD", null);

    await scanDeadlines();

    expect(await mine()).toEqual([]);
  });

  it("sends nothing new on a second run, and tells the bell once", async () => {
    await createDocument("HARD", 30);
    // One `now` for both runs, or a seeded ID on the 90-day line could cross it in between.
    const now = new Date();

    await scanDeadlines(now);
    expect(await scanDeadlines(now)).toBe(0);

    const saved = await prisma.notification.findFirstOrThrow({ where: { recipientId: owner } });
    const told = vi
      .mocked(publish)
      .mock.calls.filter(([event]) => event.type === "notification.created" && event.recipientId === owner);
    expect(told).toEqual([
      [{ type: "notification.created", notificationId: saved.id, recipientId: owner, at: saved.createdAt.toISOString() }],
    ]);
  });

  it("tells the owner again once the ID has expired", async () => {
    const id = await createDocument("HARD", 30);
    await scanDeadlines();

    await prisma.document.update({ where: { id }, data: { targetDate: new Date(Date.now() - 10 * DAY_MS) } });
    await scanDeadlines();

    expect(await mine()).toEqual([
      { documentId: id, type: "DEADLINE" },
      { documentId: id, type: "DEADLINE_PASSED" },
    ]);
  });

  it("drops the notification with its document", async () => {
    const id = await createDocument("HARD", 30);
    await scanDeadlines();

    await prisma.document.delete({ where: { id } });

    expect(await mine()).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run src/worker/scan.test.ts`
Expected: FAIL, `Failed to resolve import "@/worker/scan"`.

- [ ] **Step 5: Write the scan**

`src/worker/scan.ts`:
```ts
import { prisma } from "@/lib/db";
import { DAY_MS, EXPIRING_SOON_DAYS, expiryStatus } from "@/lib/documents/status";
import { publish } from "@/lib/realtime/publish";

const TYPE = { EXPIRING_SOON: "DEADLINE", EXPIRED: "DEADLINE_PASSED" } as const;

/**
 * Tells the owner of each HARD document that it expires soon, then that it has expired:
 * one notification per (document, type). @@unique([documentId, type]) makes every later
 * run, or a run at the same time, insert nothing. Returns how many it created.
 */
export async function scanDeadlines(now: Date = new Date()): Promise<number> {
  const documents = await prisma.document.findMany({
    where: {
      deadlineType: "HARD",
      targetDate: { lte: new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS) },
    },
    select: { id: true, ownerId: true, targetDate: true },
  });

  // targetDate <= cutoff already excludes documents with no date (null never satisfies
  // lte), so targetDate below is never null.
  const data = documents.flatMap((document) => {
    const status = expiryStatus(document.targetDate!, now);
    if (status === "VALID") {
      return [];
    }
    return [{ recipientId: document.ownerId, documentId: document.id, type: TYPE[status], content: "{}" }];
  });
  if (data.length === 0) {
    return 0;
  }

  const created = await prisma.notification.createManyAndReturn({ data, skipDuplicates: true });
  for (const notification of created) {
    await publish({
      type: "notification.created",
      notificationId: notification.id,
      recipientId: notification.recipientId,
      at: notification.createdAt.toISOString(),
    });
  }
  return created.length;
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `npx vitest run src/worker/scan.test.ts`
Expected: 5 passed.

- [ ] **Step 7: Mutation check**

Remove `skipDuplicates: true`. *sends nothing new on a second run* must fail (a P2002 error). Then put it back.

- [ ] **Step 8: Whole suite**

Run: `npx vitest run --maxWorkers=1 && npm run lint`
Expected: the baseline count + 9, all green; lint 0/0.

- [ ] **Step 9: Commit (with Rasiol's go-ahead)**

```bash
git add prisma/schema.prisma prisma/migrations src/worker/scan.ts src/worker/scan.test.ts
git commit -m "feat(worker): notify expiring and expired documents, once each"
```

---

### Task 3: Show it in the bell

**What it does:** the bell and `/notifications` show *Votre document « carte.pdf » expire le 19 décembre 2026.*, and clicking it opens the document.

**Files:**
- Modify: `src/lib/notifications/notifications.ts` (`withNames`, `notificationHref`)
- Modify: `src/lib/notifications/views.ts`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json` (`notifications`)
- Test: `src/lib/notifications/notifications.test.ts`, `src/lib/notifications/views.test.ts`

**Interfaces:**
- Consumes: `NotificationType.DEADLINE` / `DEADLINE_PASSED` and `Notification.documentId` from Task 2.
- Produces: `withNames()` rows gain `document: { id: number; fileName: string; targetDate: Date | null } | null`; `notificationHref()` takes an optional `document?: { id: number } | null`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/notifications/notifications.test.ts`, inside `describe("notificationHref", …)`, add:
```ts
  it("opens the document of a deadline", () => {
    expect(notificationHref({ type: "DEADLINE_PASSED", actor: null, channel: null, document: { id: 7 } })).toBe(
      "/documents/view/7",
    );
  });
```

In `src/lib/notifications/views.test.ts`, add a helper above `describe` and two tests inside it:
```ts
async function deadlineFor(recipientId: string, type: "DEADLINE" | "DEADLINE_PASSED") {
  const document = await prisma.document.create({
    data: {
      ownerId: recipientId,
      fileName: "carte.pdf",
      fileType: "application/pdf",
      fileSize: 1,
      fileData: Buffer.from("x"),
      fileHash: randomUUID(),
      deadlineType: "HARD",
      targetDate: new Date("2027-03-15T00:00:00Z"),
    },
  });
  await prisma.notification.create({ data: { recipientId, type, documentId: document.id, content: "{}" } });
}
```
```ts
  it("names the document that expires soon, with its date", async () => {
    await deadlineFor(alice, "DEADLINE");

    const [view] = await notificationViews(alice);

    expect(view?.text).toBe('deadline{"name":"carte.pdf","date":"formatted"}');
  });

  it("names the document that has expired", async () => {
    await deadlineFor(alice, "DEADLINE_PASSED");

    const [view] = await notificationViews(alice);

    expect(view?.text).toBe('deadlinePassed{"name":"carte.pdf","date":"formatted"}');
  });
```
(`afterEach` already deletes `alice`, which cascades her documents and notifications.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/notifications/`
Expected: 3 FAIL. `notificationHref` returns `/notifications`; both views fall to `other`.

- [ ] **Step 3: Load the document in `withNames()`**

In `src/lib/notifications/notifications.ts`, `withNames()` becomes:
```ts
async function withNames(rows: Notification[]) {
  const data = rows.map((row) => parse(row.content));
  const userIds = [...new Set(data.flatMap((d) => (d ? [d.userId] : [])))];
  const channelIds = [...new Set(data.flatMap((d) => (d?.channelId ? [d.channelId] : [])))];
  const documentIds = [...new Set(rows.flatMap((row) => (row.documentId ? [row.documentId] : [])))];
  const [users, channels, documents] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } }),
    prisma.channel.findMany({ where: { id: { in: channelIds } }, select: { id: true, title: true } }),
    // Written only by the deadline scan, for the document's owner.
    prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, fileName: true, targetDate: true },
    }),
  ]);
  return rows.map((row, i) => ({
    id: row.id,
    type: row.type,
    isRead: row.isRead,
    createdAt: row.createdAt,
    actor: users.find((user) => user.id === data[i]?.userId) ?? null,
    channel: channels.find((channel) => channel.id === data[i]?.channelId) ?? null,
    document: documents.find((document) => document.id === row.documentId) ?? null,
  }));
}
```

And `notificationHref()`:
```ts
export function notificationHref(notification: {
  type: NotificationType;
  actor: { id: string } | null;
  channel: { id: number } | null;
  document?: { id: number } | null;
}): string {
  switch (notification.type) {
    case "FRIEND_REQUEST":
      return "/friends";
    case "REPLY":
      return notification.channel ? `/channels/${notification.channel.id}` : "/channels";
    case "MESSAGE":
      return notification.actor ? `/messages/${notification.actor.id}` : "/notifications";
    case "DEADLINE":
    case "DEADLINE_PASSED":
      return notification.document ? `/documents/view/${notification.document.id}` : "/notifications";
    default:
      return "/notifications";
  }
}
```

- [ ] **Step 4: The texts**

In `src/lib/notifications/views.ts`, inside the `map`, after `const name = …`:
```ts
    const deadline = notification.document?.targetDate
      ? {
          name: notification.document.fileName,
          date: format.dateTime(notification.document.targetDate, { dateStyle: "long" }),
        }
      : null;
```
and two cases before `default:`:
```ts
      case "DEADLINE":
        text = deadline ? t("deadline", deadline) : t("other");
        break;
      case "DEADLINE_PASSED":
        text = deadline ? t("deadlinePassed", deadline) : t("other");
        break;
```

In each catalogue, under `notifications`, after `"other"`:
- `messages/fr.json`:
  ```json
  "deadline": "Votre document « {name} » expire le {date}.",
  "deadlinePassed": "Votre document « {name} » a expiré le {date}.",
  ```
- `messages/en.json`:
  ```json
  "deadline": "Your document \"{name}\" expires on {date}.",
  "deadlinePassed": "Your document \"{name}\" expired on {date}.",
  ```
- `messages/es.json`:
  ```json
  "deadline": "Su documento «{name}» vence el {date}.",
  "deadlinePassed": "Su documento «{name}» venció el {date}.",
  ```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run src/lib/notifications/`
Expected: all green, the 3 new tests included.

- [ ] **Step 6: Gates**

Run: `npx vitest run --maxWorkers=1 && npm run lint && npm run i18n:check`
Expected: the baseline + 12, all green; lint 0/0; i18n in sync, no unused key.

- [ ] **Step 7: Commit (with Rasiol's go-ahead)**

```bash
git add src/lib/notifications messages
git commit -m "feat(notifications): show expiry notifications and open the document"
```

---

### Task 4: Run it every minute

**What it does:** starts the scan as its own process, locally and in compose. Then it's checked in the browser, and the docs are brought up to date.

**Files:**
- Create: `src/worker/main.ts`
- Modify: `package.json` (`scripts`), `docker-compose.yml` (a `worker` service)
- Modify: `CLAUDE.md`, `handoff/WORKLOG.md`, `PROJECT_PLAN.md` (the D row of the status table)

**Interfaces:**
- Consumes: `scanDeadlines()` from Task 2.

- [ ] **Step 1: The loop**

`src/worker/main.ts` (the package is CommonJS, so no top-level `await`):
```ts
import { setTimeout as sleep } from "node:timers/promises";
import { config } from "dotenv";
import { scanDeadlines } from "./scan";

// npm run worker runs outside Next, so nobody else loads .env. Already-set variables win (compose).
config({ quiet: true });

// ponytail: each minute re-reads every HARD document due within 90 days, expired ones
// included forever; leave out the already-notified ones in the query if that ever shows.
const INTERVAL_MS = 60_000;

// One scan at a time: the next starts a minute after the last one ends. Stopping mid-scan
// loses nothing, since the unique index lets the next run redo it.
async function run() {
  console.log("deadline worker started");
  for (;;) {
    try {
      const created = await scanDeadlines();
      if (created > 0) {
        console.log(`deadline scan: ${created} notification(s)`);
      }
    } catch (error) {
      console.error("deadline scan failed", error);
    }
    await sleep(INTERVAL_MS);
  }
}

void run();
```

In `package.json` `scripts`, under `"realtime"`:
```json
    "worker": "tsx src/worker/main.ts",
```

- [ ] **Step 2: The compose service**

In `docker-compose.yml`, after the `realtime` service:
```yaml
  # ── Deadline worker ─────────────────────────────────────────────────────────
  worker:
    build: .
    container_name: mespapiers_worker
    restart: unless-stopped
    command: ["sh", "-c", "npx prisma generate && npx tsx src/worker/main.ts"]
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public"
      # Pushes each new notification to the bell; without them it shows on the next page load.
      REALTIME_INTERNAL_URL: "http://realtime:3001"
      REALTIME_PUBLISH_SECRET: "${REALTIME_PUBLISH_SECRET:-}"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma
      # Its own generated client, like realtime, so its `prisma generate` leaves the host's alone.
      - /app/src/generated
```

- [ ] **Step 3: Gates, before any container restart**

Run: `npx vitest run --maxWorkers=1 && npm run lint && npm run i18n:check && npm run build && npm run typecheck`
Expected: the baseline + 12, all green; lint 0/0; i18n clean; build and typecheck pass.

Run these first. Step 4 restarts `web`, which regenerates the Prisma client into the bind-mounted `src/generated` and breaks it for the host (`CLAUDE.md` → *Prisma engine flips*).

- [ ] **Step 4: Start it and watch it work**

```bash
docker restart mespapiers_web
docker compose up -d --build worker
docker logs mespapiers_worker
```
Expected: `deadline worker started`. The `deadline scan: N notification(s)` line appears only if the tests had not already notified the seeded users. Then list the deadline notifications:
```bash
docker exec -i mespapiers_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
select u.email, n.type, n.document_id, d."targetDate"::date
from "Notification" n
join "User" u on u.id = n.recipient_id
join "Document" d on d.id = n.document_id
order by u.email;
SQL
```
Expected: `DEADLINE_PASSED` for `maria.garcia@` and `rasiol@`, `DEADLINE` for `fatima.ben.ali@`, and `DEADLINE` for `sarah@` (her ID sits on the 90-day line, so it may appear one scan later). No row for an insurance document.

- [ ] **Step 5: Browser check (`https://mespapiers.local:8443`, seeded password `motdepasse123`)**

| # | Do | Expect |
|---|---|---|
| 1 | Log in as `fatima.ben.ali@mespapiers.test` | The bell shows 1 unread: *Votre document « … » expire le …* with the date from step 4 |
| 2 | Click it | `/fr/documents/view/<id>`, the same document; the bell count drops |
| 3 | Switch to `/en`, open `/en/notifications` | *Your document "…" expires on …* |
| 4 | Log in as `rasiol@mespapiers.test` | *Votre document « … » a expiré le …* |
| 5 | Log in as `amir@mespapiers.test` and stay on the dashboard. In a terminal, move his ID to 10 days from now (below) | Within a minute, with no reload, the bell shows 1 unread |
| 6 | `docker restart mespapiers_worker`, wait a minute, rerun step 4's query | No new row |
| 7 | DevTools console on `/fr/notifications` | No error or warning |

Row 5's update:
```bash
docker exec -i mespapiers_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
update "Document" d set "targetDate" = now() + interval '10 days'
from "User" u
where u.id = d."ownerId" and u.email = 'amir@mespapiers.test' and d."deadlineType" = 'HARD';
SQL
```
This moves a seeded date. A later `npm run db:reset` restores it. To run the host tests again after this step, fix the client first (`CLAUDE.md` → *Prisma engine flips*).

- [ ] **Step 6: Docs**

- `CLAUDE.md`, *What exists*: add a bullet:
  > **Expiry notifications (D7, HARD only; plan [`docs/plans/2026-11-04-d7-expiry-notifications.md`](docs/plans/2026-11-04-d7-expiry-notifications.md)):** `expiryStatus()` in `src/lib/documents/status.ts` (`EXPIRING_SOON` within 90 days, `EXPIRED` from the day after the date). The `worker` process (`src/worker/main.ts`, `npm run worker`, the `worker` compose service) runs `scanDeadlines()` (`src/worker/scan.ts`) every minute: one `DEADLINE` and one `DEADLINE_PASSED` notification per HARD document, idempotent through `Notification`'s `@@unique([documentId, type])` (`documentId` cascades), pushed to the bell with `notification.created`. Texts are `notifications.deadline` / `deadlinePassed`; the link opens the document. No email, no SOFT/PERIODIC, no `deriveStatus()` yet.
- `CLAUDE.md`, *What does not exist*: remove "the `worker` process" from the list.
- `CLAUDE.md`, *Full stack in Docker*: "five services" → "six", plus a `worker` bullet: the same image, `npx prisma generate && npx tsx src/worker/main.ts`, no port, its own `/app/src/generated` volume like `realtime`.
- `CLAUDE.md`, *Realtime → Publishing → Callers*: add `scanDeadlines` (`notification.created`).
- `PROJECT_PLAN.md`, the status table's D row: add "D7 and the HARD part of D8–D9 (in-app only, plan `2026-11-04-d7`)" to *On main* once merged, and to *In an open PR* until then.
- `handoff/WORKLOG.md`: a dated entry with the commits, the gates and the browser check result.

- [ ] **Step 7: Commit (with Rasiol's go-ahead)**

```bash
git add src/worker/main.ts package.json docker-compose.yml
git commit -m "feat(worker): run the deadline scan every minute"
git add CLAUDE.md handoff/WORKLOG.md PROJECT_PLAN.md docs/plans/2026-11-04-d7-expiry-notifications.md
git commit -m "docs: expiry notifications"
```

Then a whole-branch review, then the push and the PR, each with Rasiol's go-ahead. The PR names Amir (schema, migration, `status.ts`), Alexandre (`notifications`, the worker) and Adrien (compose) as reviewers.
