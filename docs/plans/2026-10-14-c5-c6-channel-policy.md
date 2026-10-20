# Phase 5 — The Policy in the Channel Actions (C5, C6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every channel Server Action authorizes through `assertCan()`, every privileged one writes one `AuditLog` row, and every channel page shows a form only to the callers its action accepts.

**Architecture:** No new module, no schema change, no change to `policy.ts`. Each action keeps its validation (silent `return`), loads the row it needs, then calls `assertCan(ctx, action, resource)` in place of its inline `role === "MODERATOR"` / `createdBy` check, and calls `writeAudit()` after the mutation, only when the mutation happened. Each page that holds one of those forms calls `can()` with the same action and resource, so the UI never offers an action that would throw.

**Tech Stack:** Next.js 16 Server Actions · Prisma 6 (`@/generated/prisma/client`) · Vitest 5 against the dev Postgres · `src/lib/auth/policy.ts` · `src/lib/audit.ts`

**Spec:** [`2026-09-21-rasiol-modules-roadmap.md`](2026-09-21-rasiol-modules-roadmap.md) phase 5 (the mapping table, tasks 5.1–5.3, the review notes) and §C-15, §C-16, §C-19 · [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) §5 (`can`/`assertCan`), §7 C5, C6

**Branch:** `feat/channel-policy`, cut from `main` = `e4f597d` on 2026-10-14. The files are Amir's (plan §4): tag him on the PR.

## Decisions (Rasiol, 2026-10-14)

1. **The page checks are part of phase 5.** A page that holds a form calls `can()` with the same action and resource as the form's action. Without this, admins gain powers that no page lets them use, and a page could offer an action that throws.
2. **Amir is asked about the behaviour changes after the PR is open.** The PR description lists them (Task 6).
3. **Audit rows are written after the mutation, only when it happened.** That includes `deleteChannel`: `AuditLog.channelId` is a plain `String?` with no foreign key, so the row outlives the channel. This matches phase 4 (`deleteUser`).
4. **Keep only what is necessary** (after Task 1). Dropped:
   - **Task 4:** the `assertCan` on `createChannel`, `joinChannel` and `requestJoinChannel`. `channel:create` and `channel:join` answer `true` for every signed-in user, so the checks could never refuse anyone, and 5.1 is met without them. Add them when a rule can refuse a join (a ban after a kick, Amir's E11).
   - **Task 2's `questionId` assertion:** `updateMany` was already scoped by `channelId`, so the assertion pinned code this phase does not change.
   - **Task 3's cross-channel answer assertion:** `deleteAnswer` has no channel field to forge; the channel comes from the answer's own row, and the moderator-delete assertion already fails if the scope is wrong.
   - **B12's extra rows:** it keeps the three 5.3 cases, the page checks, the audit query and one graded row.

   Kept on purpose (Rasiol): **the final whole-branch review** (between Task 5 and Task 6). The roadmap does not require it, but the reviews in phases 3 and 4 each caught a real bug, and this phase changes security checks in someone else's code.

## Departures from the roadmap's phase 5

| Roadmap | This plan | Why |
|---|---|---|
| `deleteChannel`: audit "**before** the delete" | after, when `deleteMany` removed the row | decision 3 |
| actions only; "role reads for *display* are fine" | also the edit, delete, kick, requests and invite pages, the channel page's answer buttons and the answer edit page | decision 1 |
| 5.3 "by hand" | by hand (`testing-auth.md` B12) **and** DB tests for the same cases | `CLAUDE.md` wants TDD; the cross-channel refusal is the graded demo, so a test keeps it from regressing |
| kick page shows *Kick* next to moderators and the viewer (open review note) | hidden on those rows | the action refuses them; decision 1's rule |
| `createChannel`, `joinChannel`, `requestJoinChannel` call `assertCan` | unchanged (Task 4 dropped) | decision 4: those checks always pass |
| — | the `/channels` list menu keeps `members[0]?.role === "MODERATOR"` | display only. Until phase 6 adds promotion, *moderator* ⇔ *creator* for every non-admin, so the menu cannot offer a refused action yet. Recorded in roadmap task 6.2 |

## Global Constraints

- Import Prisma from `@/generated/prisma/client`, never `@prisma/client`. Use the `prisma` singleton from `src/lib/db.ts`.
- `policy.ts` and the `Action` union do not change: changing them changes a published interface (whole-team decision).
- Validation failures (bad id, empty text) keep their silent `return`. Authorization becomes `assertCan`, called after loading the row it needs.
- Every user-visible string is a `next-intl` key. This plan adds **no** string.
- Import `Link` and `redirect` from `@/i18n/navigation`. `notFound` comes from `next/navigation`.
- Zero ESLint warnings. Zero console errors on every route a user reaches without forging a request. Responsive at 375 / 768 / 1440.
- Conventional Commits (`feat(channels): …`). **No commit without Rasiol's go-ahead**; stage by path.
- DB tests hit the real Postgres from `.env`; each creates its own `test-<uuid>@mespapiers.test` users and deletes everything it created.
- Browser checks run on `https://mespapiers.local`, never `localhost`.
- Do not touch lines outside the authorization change: the bare `revalidatePath("/channels…")` calls, the untranslated role on the kick page and the double-click 500s stay, and go into the PR's notes for Amir (Task 6).

## Review Focus

1. **A double click on a moderation action**: the second call finds nothing, resolves without throwing and writes no second audit row. Pinned by Task 1 (kick) and Task 2 (delete channel).
2. **A forged id that points into another channel**: a kick with channel B's id is refused. Pinned by Task 1 (5.3). Answers and the edit form's `questionId` take their channel from the row or a channel-scoped query, so there is no channel field to forge (decision 4).
3. **A page offering an action its action refuses**: the action throws, so the user gets Next's error page and a console error. Pages can't be unit-tested here, so `testing-auth.md` B12 checks each page as a plain member, a moderator and an admin (Task 5).
4. **A channel with no moderator and no creator** (§C-19, after an admin deletes its creator): only an admin can kick, edit or delete there. Pinned by Task 1 (admin kick) and B12 (admin opens its delete page).
5. **An admin who is not a member**: the management pages and actions accept them, but the channel page itself still returns 404 (viewing a channel is not an `Action`) and `/channels` lists only their own channels, so they reach those pages by URL. That is expected; the PR description says so (Task 6), so nobody reports it as a bug.

---

## File map

| File | Task | Change |
|---|---|---|
| `src/app/[locale]/(app)/channels/channel-policy.test.ts` | 1, 2, 3 | **new**: DB tests for every task |
| `channels/[id]/kick/action.ts` + `page.tsx` | 1 | `channel:moderate`; audit `channel:kick`; button hidden on refused rows |
| `channels/[id]/requests/action.ts` + `page.tsx` | 1 | `channel:moderate`; audit `channel:acceptRequest` / `channel:rejectRequest` |
| `channels/[id]/invite/action.ts` + `page.tsx` | 1 | `channel:moderate`; audit `channel:invite` |
| `channels/[id]/edit/action.ts` + `page.tsx` | 2 | `channel:update`; audit `channel:update` |
| `channels/[id]/delete/action.ts` + `page.tsx` | 2 | `channel:delete`; audit `channel:delete`, after the delete |
| `channels/[id]/actions.ts` | 3 | `answer:create`, `answer:update`, `answer:delete`; audit `answer:delete` when actor ≠ author. `leaveChannel` unchanged |
| `channels/[id]/page.tsx`, `channels/[id]/answers/[answerId]/edit/page.tsx` | 3 | answer buttons and the edit page gated with `can()` |
| `docs/testing-auth.md`, `CLAUDE.md`, `handoff/WORKLOG.md`, the roadmap | 5 | B12, counts, status |

**Line numbers** refer to the files on `main` (`e4f597d`), before any edit in this plan. Adding an import shifts them, so each instruction also quotes the code it replaces: go by the quote.

Unchanged on purpose: `acceptInvite` / `declineInvite` (`invitations/action.ts`) and `leaveChannel`, because each acts on the caller's own row and that row is the authorization; `createChannel`, `joinChannel` and `requestJoinChannel` (decision 4).

Audit vocabulary, used by every task:

| Action | `action` | `targetType` | `targetId` | `channelId` |
|---|---|---|---|---|
| `kickMembers` | `channel:kick` | `User` | kicked user id | the channel |
| `acceptJoinRequest` | `channel:acceptRequest` | `User` | applicant id | the channel |
| `rejectJoinRequest` | `channel:rejectRequest` | `User` | applicant id | the channel |
| `inviteUser` | `channel:invite` | `User` | invited user id | the channel |
| `editChannel` | `channel:update` | `Channel` | `String(channelId)` | the channel |
| `deleteChannel` | `channel:delete` | `Channel` | `String(channelId)` | the channel |
| `deleteAnswer` (actor ≠ author) | `answer:delete` | `Answer` | `String(answerId)` | the answer's channel |

---

### Task 0: Commit the docs sync and this plan

**Files:** `CLAUDE.md`, `handoff/WORKLOG.md`, `docs/plans/2026-09-21-rasiol-modules-roadmap.md`, `docs/plans/2026-10-14-c5-c6-channel-policy.md`

- [ ] **Step 1: Check what is staged**

Run: `git status -s`
Expected: only the four files above. `.env` must not appear.

- [ ] **Step 2: Commit (with Rasiol's go-ahead)**

```bash
git add CLAUDE.md handoff/WORKLOG.md docs/plans/2026-09-21-rasiol-modules-roadmap.md docs/plans/2026-10-14-c5-c6-channel-policy.md
git commit -m "docs: sync after PRs #31 and #32, plan phase 5"
```

---

### Task 1: Moderation actions — kick, join requests, invite (`channel:moderate`)

**Files:**
- Create: `src/app/[locale]/(app)/channels/channel-policy.test.ts`
- Modify: `src/app/[locale]/(app)/channels/[id]/kick/action.ts`, `[id]/kick/page.tsx`
- Modify: `src/app/[locale]/(app)/channels/[id]/requests/action.ts`, `[id]/requests/page.tsx`
- Modify: `src/app/[locale]/(app)/channels/[id]/invite/action.ts`, `[id]/invite/page.tsx`

**Interfaces:**
- Consumes: `can`, `assertCan`, `ForbiddenError` from `@/lib/auth/policy`; `writeAudit({ actorUserId, action, targetType, targetId, channelId })` from `@/lib/audit`; `requireUser(): Promise<SessionContext>` (`ctx.user.id`, `ctx.user.globalRole`, `ctx.memberships`).
- Produces: the test file and its helpers (`newUser`, `newChannel`, `signInAs`, `form`, `isMember`, `auditRows`), which Tasks 2 and 3 append to.

- [ ] **Step 1: Write the failing tests** — `src/app/[locale]/(app)/channels/channel-policy.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/auth/policy";
import { createSession, requireUser, validateSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { kickMembers } from "./[id]/kick/action";
import { acceptJoinRequest, rejectJoinRequest } from "./[id]/requests/action";
import { inviteUser } from "./[id]/invite/action";

// requireUser() reads the cookie, and revalidatePath(), getLocale() and the localised
// redirect() need a Next request, so the four are replaced. The context the actions
// get is still real: loaded from a real Session row, memberships included.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "fr") }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));

type Role = "MEMBER" | "MODERATOR";
let created: { users: string[]; channels: number[] } = { users: [], channels: [] };

async function newUser(globalRole: GlobalRole = "USER") {
  const user = await prisma.user.create({
    data: { email: `test-${randomUUID()}@mespapiers.test`, displayName: "Test", globalRole },
  });
  created.users.push(user.id);
  return user;
}

// A channel and its one question, as createChannel makes them. createdBy is null
// when the creator was deleted (§C-19), and need not be one of the moderators.
async function newChannel(members: Record<string, Role>, createdBy: string | null = null) {
  const channel = await prisma.channel.create({
    data: {
      title: `test-${randomUUID()}`,
      createdBy,
      members: { create: Object.entries(members).map(([userId, role]) => ({ userId, role })) },
      threads: { create: { title: "Question", content: "Question", userId: createdBy } },
    },
    include: { threads: true },
  });
  created.channels.push(channel.id);
  return { id: channel.id, threadId: channel.threads[0]!.id };
}

// Call it AFTER creating the channels: the context's memberships are read here, once,
// exactly as requireUser() reads them once per request.
async function signInAs(userId: string) {
  const { token } = await createSession(userId);
  vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
}

function form(fields: Record<string, string | number>): FormData {
  const f = new FormData();
  for (const [name, value] of Object.entries(fields)) f.set(name, String(value));
  return f;
}

const isMember = async (channelId: number, userId: string) =>
  (await prisma.channelMember.count({ where: { channelId, userId } })) === 1;
const auditRows = (channelId: number) =>
  prisma.auditLog.findMany({ where: { channelId: String(channelId) } });

afterEach(async () => {
  // Audit rows first: their channelId is a plain string, so no cascade reaches them.
  await prisma.auditLog.deleteMany({ where: { channelId: { in: created.channels.map(String) } } });
  // Cascades members, threads, answers, invites and join requests.
  await prisma.channel.deleteMany({ where: { id: { in: created.channels } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  created = { users: [], channels: [] };
});

describe("moderation actions (channel:moderate)", () => {
  it("refuses a plain member on every moderation action, and changes nothing", async () => {
    const mod = await newUser();
    const member = await newUser();
    const other = await newUser();
    const applicant = await newUser();
    const outsider = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [member.id]: "MEMBER", [other.id]: "MEMBER" }, mod.id);
    await prisma.channelJoinRequest.create({ data: { channelId: c.id, userId: applicant.id } });
    await signInAs(member.id);

    await expect(kickMembers(form({ channelId: c.id, userId: other.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(acceptJoinRequest(form({ channelId: c.id, userId: applicant.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rejectJoinRequest(form({ channelId: c.id, userId: applicant.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(inviteUser(form({ channelId: c.id, userId: outsider.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await isMember(c.id, other.id)).toBe(true);
    expect(await isMember(c.id, applicant.id)).toBe(false);
    expect(await prisma.channelJoinRequest.count({ where: { channelId: c.id } })).toBe(1);
    expect(await prisma.channelInvite.count({ where: { channelId: c.id } })).toBe(0);
    expect(await auditRows(c.id)).toEqual([]);
  });

  it("refuses a moderator of one channel who replays a kick with another channel's id", async () => {
    const modA = await newUser();
    const modB = await newUser();
    const member = await newUser();
    await newChannel({ [modA.id]: "MODERATOR" }, modA.id);
    const b = await newChannel({ [modB.id]: "MODERATOR", [member.id]: "MEMBER" }, modB.id);
    await signInAs(modA.id);

    await expect(kickMembers(form({ channelId: b.id, userId: member.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await isMember(b.id, member.id)).toBe(true);
    expect(await auditRows(b.id)).toEqual([]);
  });

  it("lets an admin who is not a member kick in a channel with no moderator, once, audited", async () => {
    const admin = await newUser("ADMIN");
    const member = await newUser();
    const c = await newChannel({ [member.id]: "MEMBER" });   // §C-19: its only moderator was deleted
    await signInAs(admin.id);

    await kickMembers(form({ channelId: c.id, userId: member.id }));
    await kickMembers(form({ channelId: c.id, userId: member.id }));   // a double click

    expect(await isMember(c.id, member.id)).toBe(false);
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({ actorUserId: admin.id, action: "channel:kick", targetType: "User", targetId: member.id }),
    ]);
  });

  it("audits accepting and rejecting a join request, and an invite", async () => {
    const mod = await newUser();
    const alice = await newUser();
    const bob = await newUser();
    const carol = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR" }, mod.id);
    await prisma.channelJoinRequest.createMany({
      data: [{ channelId: c.id, userId: alice.id }, { channelId: c.id, userId: bob.id }],
    });
    await signInAs(mod.id);

    await acceptJoinRequest(form({ channelId: c.id, userId: alice.id }));
    await rejectJoinRequest(form({ channelId: c.id, userId: bob.id }));
    await inviteUser(form({ channelId: c.id, userId: carol.id }));

    expect(await isMember(c.id, alice.id)).toBe(true);
    expect(await isMember(c.id, bob.id)).toBe(false);
    expect(await prisma.channelInvite.count({ where: { channelId: c.id, userId: carol.id } })).toBe(1);
    const rows = await auditRows(c.id);
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorUserId: mod.id, action: "channel:acceptRequest", targetType: "User", targetId: alice.id }),
      expect.objectContaining({ actorUserId: mod.id, action: "channel:rejectRequest", targetType: "User", targetId: bob.id }),
      expect.objectContaining({ actorUserId: mod.id, action: "channel:invite", targetType: "User", targetId: carol.id }),
    ]));
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run "src/app/[locale]/(app)/channels"`
Expected: 4 failed. The two refusal tests fail with *promise resolved "undefined" instead of rejecting*, because today's inline checks `return` silently. The admin test fails on `isMember(...) === false`, because the admin has no MODERATOR row. The audit test fails on `toHaveLength(3)` (0 rows).

- [ ] **Step 3: Rewrite `kickMembers`** — `src/app/[locale]/(app)/channels/[id]/kick/action.ts`

```ts
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

export async function kickMembers(formData: FormData) {
  const channelId = formData.get("channelId");
  const targetUserId = formData.get("userId");

  if (typeof channelId !== "string" || typeof targetUserId !== "string" || !channelId || !targetUserId)
    return;

  const channelIdTrim = channelId.trim();
  const targetUserIdTrim = targetUserId.trim();
  if (channelIdTrim.length === 0 || targetUserIdTrim.length === 0)
    return;

  const intChannelId = parseInt(channelIdTrim, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0 || String(intChannelId) !== channelIdTrim)
    return;

  const ctx = await requireUser();

  if (targetUserIdTrim === ctx.user.id)
    return;

  // A moderator of THIS channel, or an admin (§C-16): can() reads the caller's role
  // in the channel the form names, so a moderator of another channel is refused.
  assertCan(ctx, "channel:moderate", { channelId: intChannelId });

  // seul un MEMBER peut etre retire, jamais un autre moderateur
  const target = await prisma.channelMember.findFirst({
    where: { channelId: intChannelId, userId: targetUserIdTrim, role: "MEMBER" },
  });
  if (!target)
    return;

  const { count } = await prisma.channelMember.deleteMany({
    where: { channelId: intChannelId, userId: targetUserIdTrim },
  });
  // Only a kick that happened is recorded.
  if (count > 0)
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:kick",
      targetType: "User",
      targetId: targetUserIdTrim,
      channelId: intChannelId,
    });

  revalidatePath("/[locale]/(app)/channels/[id]/kick", "page");
  revalidatePath("/[locale]/(app)/channels/[id]", "page");
}
```

- [ ] **Step 4: Rewrite the join-request actions** — `src/app/[locale]/(app)/channels/[id]/requests/action.ts`

```ts
"use server"
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

export async function acceptJoinRequest(formData: FormData) {
  const ctx = await requireUser();

  const idChannel = formData.get("channelId");
  const idUser = formData.get("userId");
  if (typeof idChannel !== "string" || typeof idUser !== "string") return;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) return;

  assertCan(ctx, "channel:moderate", { channelId: id });

  const joinRequest = await prisma.channelJoinRequest.findFirst({
    where: {
      channelId: id,
      userId: idUser,
    },
  });
  if (!joinRequest) return;

  await prisma.channelMember.create({
    data: {
      channelId: id,
      userId: idUser,
      role: "MEMBER",
    },
  });

  await prisma.channelJoinRequest.deleteMany({
    where: {
      channelId: id,
      userId: idUser,
    },
  });

  await writeAudit({
    actorUserId: ctx.user.id,
    action: "channel:acceptRequest",
    targetType: "User",
    targetId: idUser,
    channelId: id,
  });

  revalidatePath("/[locale]/channels/[id]/requests", "page");
}

export async function rejectJoinRequest(formData: FormData) {
  const ctx = await requireUser();

  const idChannel = formData.get("channelId");
  const idUser = formData.get("userId");
  if (typeof idChannel !== "string" || typeof idUser !== "string") return;

  const id = parseInt(idChannel, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== idChannel) return;

  assertCan(ctx, "channel:moderate", { channelId: id });

  const { count } = await prisma.channelJoinRequest.deleteMany({
    where: {
      channelId: id,
      userId: idUser,
    },
  });
  if (count > 0)
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:rejectRequest",
      targetType: "User",
      targetId: idUser,
      channelId: id,
    });

  revalidatePath("/[locale]/channels/[id]/requests", "page");
}
```

The `revalidatePath` pattern without `(app)` is wrong but pre-existing (a review note for Amir); leave it.

- [ ] **Step 5: Rewrite the authorization part of `inviteUser`** — `src/app/[locale]/(app)/channels/[id]/invite/action.ts`

Add two imports under the existing ones:

```ts
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
```

Replace lines 39–50 (`const { user } = await requireUser();` through `if (!member) return;`) with:

```ts
  const ctx = await requireUser();
  const channel = await prisma.channel.findFirst({
    where: { id: intChannelId },
  });

  if (!channel) {
    return;
  }
  assertCan(ctx, "channel:moderate", { channelId: channel.id });
```

Replace the `channelInvite.create` call and the `redirect` after it with:

```ts
  await prisma.channelInvite.create({
    data: {
      channelId: intChannelId,
      userId: trueUserId,
    },
  });
  await writeAudit({
    actorUserId: ctx.user.id,
    action: "channel:invite",
    targetType: "User",
    targetId: trueUserId,
    channelId: intChannelId,
  });
  redirect({ href: "/channels", locale: await getLocale() });
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run "src/app/[locale]/(app)/channels"`
Expected: 4 passed.

- [ ] **Step 7: Gate the kick page** — `src/app/[locale]/(app)/channels/[id]/kick/page.tsx`

Add `import { can } from "@/lib/auth/policy";` to the imports. Replace lines 21–29 (`const { user } = await requireUser();` through `if (!userMember || userMember.role !== "MODERATOR") return;`) with:

```tsx
  const ctx = await requireUser();
  // The same check as kickMembers: a moderator of this channel, or an admin.
  if (!can(ctx, "channel:moderate", { channelId: id })) notFound();
```

Wrap the `<button type="submit" …>{t("kick")}</button>` (lines 83–88) so it only renders on rows the action accepts:

```tsx
              {/* kickMembers refuses yourself and moderators: no button that does nothing */}
              {membre.role === "MEMBER" && membre.userId !== ctx.user.id && (
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {t("kick")}
                </button>
              )}
```

- [ ] **Step 8: Gate the requests page** — `src/app/[locale]/(app)/channels/[id]/requests/page.tsx`

Remove `import { prisma } from "@/lib/db";` (its only use was the membership lookup) and add `import { can } from "@/lib/auth/policy";`. Replace lines 23–33 (`const { user } = await requireUser();` through the closing `}` of the `notFound()` block) with:

```tsx
  const ctx = await requireUser();
  // The same check as acceptJoinRequest / rejectJoinRequest.
  if (!can(ctx, "channel:moderate", { channelId: id })) {
    notFound();
  }
```

- [ ] **Step 9: Gate the invite page** — `src/app/[locale]/(app)/channels/[id]/invite/page.tsx`

Add `import { notFound } from "next/navigation";` and `import { can } from "@/lib/auth/policy";`. Change line 27 to `const ctx = await requireUser();`, and replace lines 34–43 (the `moderator` lookup and its `if`) with:

```tsx
  // The same check as inviteUser.
  if (!can(ctx, "channel:moderate", { channelId: channel.id })) notFound();
```

- [ ] **Step 10: Lint and typecheck the touched files**

Run: `npx eslint "src/app/[locale]/(app)/channels" && npx tsc --noEmit`
Expected: no output from eslint; tsc exits 0. If tsc complains about missing `.next/types`, run `npm run build` once first (`CLAUDE.md`, *Typecheck ordering*).

- [ ] **Step 11: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/channels/channel-policy.test.ts" "src/app/[locale]/(app)/channels/[id]/kick" "src/app/[locale]/(app)/channels/[id]/requests" "src/app/[locale]/(app)/channels/[id]/invite"
git commit -m "feat(channels): moderation actions authorize with assertCan and write audit rows"
```

---

### Task 2: Edit and delete a channel (`channel:update`, `channel:delete`)

**Files:**
- Modify: `src/app/[locale]/(app)/channels/channel-policy.test.ts` (append)
- Modify: `src/app/[locale]/(app)/channels/[id]/edit/action.ts`, `[id]/edit/page.tsx`
- Modify: `src/app/[locale]/(app)/channels/[id]/delete/action.ts`, `[id]/delete/page.tsx`

**Interfaces:**
- Consumes: Task 1's helpers in the test file.
- Behaviour change (listed for Amir in Task 6): edit goes from *the creator* to *any moderator of the channel, or an admin*; delete goes from *any moderator* to *the creator, or an admin*.

- [ ] **Step 1: Write the failing tests** — append to `channel-policy.test.ts`

Add to the imports:

```ts
import { editChannel } from "./[id]/edit/action";
import { deleteChannel } from "./[id]/delete/action";
```

Append:

```ts
describe("editing and deleting a channel", () => {
  const editForm = (channelId: number, questionId: number) =>
    form({ channelId, questionId, name: "Nouveau titre", description: "Nouvelle description", question: "Nouvelle question" });

  it("refuses a plain member's edit; a moderator who is not the creator edits, audited", async () => {
    const creator = await newUser();
    const mod = await newUser();
    const member = await newUser();
    const a = await newChannel({ [creator.id]: "MODERATOR", [mod.id]: "MODERATOR", [member.id]: "MEMBER" }, creator.id);

    await signInAs(member.id);
    await expect(editChannel(editForm(a.id, a.threadId))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await prisma.channel.findUnique({ where: { id: a.id } }))?.title).not.toBe("Nouveau titre");

    await signInAs(mod.id);
    await editChannel(editForm(a.id, a.threadId));

    expect((await prisma.channel.findUnique({ where: { id: a.id } }))?.title).toBe("Nouveau titre");
    expect(await auditRows(a.id)).toEqual([
      expect.objectContaining({ actorUserId: mod.id, action: "channel:update", targetType: "Channel", targetId: String(a.id) }),
    ]);
  });

  it("refuses a delete by a moderator who is not the creator", async () => {
    const creator = await newUser();
    const mod = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [mod.id]: "MODERATOR" }, creator.id);
    await signInAs(mod.id);

    await expect(deleteChannel(form({ deletechannel: c.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await prisma.channel.findUnique({ where: { id: c.id } })).not.toBeNull();
    expect(await auditRows(c.id)).toEqual([]);
  });

  it("lets the creator delete the channel, audited once, after the delete", async () => {
    const creator = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR" }, creator.id);
    await signInAs(creator.id);

    await deleteChannel(form({ deletechannel: c.id }));
    await expect(deleteChannel(form({ deletechannel: c.id }))).resolves.toBeUndefined();   // a double click

    expect(await prisma.channel.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({ actorUserId: creator.id, action: "channel:delete", targetType: "Channel", targetId: String(c.id) }),
    ]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run "src/app/[locale]/(app)/channels" -t "editing and deleting"`
Expected: 3 failed. The member's edit resolves instead of rejecting (silent `return` on `createdBy`). The moderator's delete resolves and deletes the channel (today any moderator may). The creator's delete leaves no audit row.

- [ ] **Step 3: Rewrite `editChannel`'s authorization** — `src/app/[locale]/(app)/channels/[id]/edit/action.ts`

Add under the existing imports:

```ts
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
```

Change line 10 to `const ctx = await requireUser();`. Replace lines 42–52 (the `findUnique` with `select: { createdBy: true }` through the `createdBy !== user.id` block) with:

```ts
  const channel = await prisma.channel.findUnique({
    where: { id: intId },
    select: { id: true },
  });
  if (!channel) {
    return;
  }

  // A moderator of this channel, or an admin. No longer "the creator only".
  assertCan(ctx, "channel:update", { channelId: intId });
```

The `thread.updateMany` below stays as it is: its `where` includes `channelId: intId`, so a forged `questionId` from another channel matches nothing. After that `if` block and before `revalidatePath`, add:

```ts
  await writeAudit({
    actorUserId: ctx.user.id,
    action: "channel:update",
    targetType: "Channel",
    targetId: String(intId),
    channelId: intId,
  });
```

- [ ] **Step 4: Rewrite `deleteChannel`** — `src/app/[locale]/(app)/channels/[id]/delete/action.ts`

```ts
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
import { requireUser } from "@/lib/auth/session";

export async function deleteChannel(formData: FormData) {
  const idChannel = formData.get("deletechannel");
  if (typeof idChannel !== "string" || !idChannel) {
    return;
  }

  const trueId = parseInt(idChannel, 10);
  if (Number.isNaN(trueId) || trueId <= 0 || String(trueId) !== idChannel) {
    return;
  }
  const ctx = await requireUser();

  const channel = await prisma.channel.findUnique({
    where: { id: trueId },
    select: { createdBy: true },
  });
  if (!channel) {
    return;
  }

  // The creator, or an admin. createdBy is null once the creator is deleted (§C-19):
  // then only an admin matches.
  assertCan(ctx, "channel:delete", { channelId: trueId, ownerUserId: channel.createdBy });

  const { count } = await prisma.channel.deleteMany({
    where: {
      id: trueId,
    },
  });
  // After the delete, and only if it happened. AuditLog.channelId is a plain string,
  // not a foreign key, so the row outlives the channel.
  if (count > 0) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:delete",
      targetType: "Channel",
      targetId: String(trueId),
      channelId: trueId,
    });
  }
  revalidatePath("/channels");
  redirect({ href: "/channels", locale: await getLocale() });
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run "src/app/[locale]/(app)/channels"`
Expected: 7 passed.

- [ ] **Step 6: Gate the edit page** — `src/app/[locale]/(app)/channels/[id]/edit/page.tsx`

Add `import { can } from "@/lib/auth/policy";`. Replace line 22 with:

```tsx
  const ctx = await requireUser();
  // The same check as editChannel.
  if (!can(ctx, "channel:update", { channelId: id })) notFound();
```

In the `findFirst` below it, replace the `where` (lines 25–28) with `where: { id: id },`.

- [ ] **Step 7: Gate the delete page** — `src/app/[locale]/(app)/channels/[id]/delete/page.tsx`

Add `import { can } from "@/lib/auth/policy";`. Replace lines 21–40 (`const { user } = await requireUser();` through the `if (!channel) { notFound(); }` block) with:

```tsx
  const ctx = await requireUser();

  const channel = await prisma.channel.findFirst({
    where: { id: id },
    include: { _count: { select: { members: true } } },
  });
  // The same check as deleteChannel: the creator, or an admin.
  if (!channel || !can(ctx, "channel:delete", { channelId: id, ownerUserId: channel.createdBy })) {
    notFound();
  }
```

- [ ] **Step 8: Lint and typecheck**

Run: `npx eslint "src/app/[locale]/(app)/channels" && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 9: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/channels/channel-policy.test.ts" "src/app/[locale]/(app)/channels/[id]/edit" "src/app/[locale]/(app)/channels/[id]/delete"
git commit -m "feat(channels): channel edit and delete authorize with assertCan and write audit rows"
```

---

### Task 3: Answers (`answer:create`, `answer:update`, `answer:delete`)

**Files:**
- Modify: `src/app/[locale]/(app)/channels/channel-policy.test.ts` (append)
- Modify: `src/app/[locale]/(app)/channels/[id]/actions.ts` (`createAnswer`, `deleteAnswer`, `modifAnswerUser`; `leaveChannel` untouched)
- Modify: `src/app/[locale]/(app)/channels/[id]/page.tsx`
- Modify: `src/app/[locale]/(app)/channels/[id]/answers/[answerId]/edit/page.tsx`

**Interfaces:**
- Consumes: Task 1's helpers.
- Behaviour change (for Amir): a moderator may delete any answer in their channel; an admin may post, edit and delete answers in any channel (tier 1 runs before the membership check, `policy.test.ts` truth table rows `answer:create` / `answer:update`).

- [ ] **Step 1: Write the failing tests** — append to `channel-policy.test.ts`

Add to the imports:

```ts
import { createAnswer, deleteAnswer, modifAnswerUser } from "./[id]/actions";
```

Append:

```ts
describe("answers", () => {
  const newAnswer = async (threadId: number, userId: string) =>
    prisma.answer.create({ data: { threadId, userId, content: "Réponse" } });

  it("refuses a plain member's delete of another answer; a moderator's delete is audited, an author's own is not", async () => {
    const mod = await newUser();
    const author = await newUser();
    const member = await newUser();
    const a = await newChannel({ [mod.id]: "MODERATOR", [author.id]: "MEMBER", [member.id]: "MEMBER" }, mod.id);
    const a1 = await newAnswer(a.threadId, author.id);
    const a2 = await newAnswer(a.threadId, author.id);

    await signInAs(member.id);
    await expect(deleteAnswer(form({ answerId: a1.id }))).rejects.toBeInstanceOf(ForbiddenError);

    await signInAs(mod.id);
    await deleteAnswer(form({ answerId: a1.id }));

    await signInAs(author.id);
    await deleteAnswer(form({ answerId: a2.id }));

    expect(await prisma.answer.count({ where: { id: { in: [a1.id, a2.id] } } })).toBe(0);
    expect(await auditRows(a.id)).toEqual([
      expect.objectContaining({ actorUserId: mod.id, action: "answer:delete", targetType: "Answer", targetId: String(a1.id) }),
    ]);
  });

  it("refuses an answer from a non-member, and an edit of someone else's answer", async () => {
    const mod = await newUser();
    const author = await newUser();
    const stranger = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [author.id]: "MEMBER" }, mod.id);
    const a1 = await newAnswer(c.threadId, author.id);

    await signInAs(stranger.id);
    await expect(createAnswer(form({ threadId: c.threadId, content: "Intrus" }))).rejects.toBeInstanceOf(ForbiddenError);

    await signInAs(mod.id);
    await expect(modifAnswerUser(form({ answerId: a1.id, channelId: c.id, content: "Réécrit" }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await prisma.answer.count({ where: { threadId: c.threadId } })).toBe(1);
    expect((await prisma.answer.findUnique({ where: { id: a1.id } }))?.content).toBe("Réponse");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run "src/app/[locale]/(app)/channels" -t "answers"`
Expected: 2 failed. The member's `deleteAnswer` rejects with a plain `Error("Utilisateur introuvable")`, not a `ForbiddenError`. The stranger's `createAnswer` resolves (silent `return`).

- [ ] **Step 3: Rewrite the three answer actions** — `src/app/[locale]/(app)/channels/[id]/actions.ts`

Add under the existing imports:

```ts
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/auth/policy";
```

In `createAnswer`, replace everything from `const { user } = await requireUser();` to the end of the function with:

```ts
  const ctx = await requireUser();

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: { channelId: true },
  });
  if (!thread) {
    return;
  }
  // Members of the thread's channel only (§C-15). The channel comes from the
  // thread row, never from the form.
  assertCan(ctx, "answer:create", { channelId: thread.channelId });

  await prisma.answer.create({
    data: {
      content: trueAnswer,
      threadId: threadId,
      userId: ctx.user.id,
    },
  });
  revalidatePath(`/channels/${thread.channelId}`);
}
```

In `deleteAnswer`, replace everything from the comment `// va recupere le user dans la basse de donnee` to the end of the function with:

```ts
  const ctx = await requireUser();

  const answer = await prisma.answer.findUnique({
    where: { id: trueId },
    select: { userId: true, thread: { select: { channelId: true } } },
  });
  if (!answer) {
    return;
  }
  const channelId = answer.thread.channelId;
  // The author, a moderator of the answer's own channel, or an admin (§5).
  assertCan(ctx, "answer:delete", { channelId, ownerUserId: answer.userId });

  const { count } = await prisma.answer.deleteMany({
    where: {
      id: trueId,
    },
  });
  // An author removing their own answer is not moderation: only someone else's is audited.
  if (count > 0 && answer.userId !== ctx.user.id) {
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "answer:delete",
      targetType: "Answer",
      targetId: String(trueId),
      channelId,
    });
  }
  revalidatePath(`/channels/${channelId}`);
}
```

In `modifAnswerUser`, change `const { user } = await requireUser();` to `const ctx = await requireUser();`, and replace the block

```ts
  // vérifie que l'utilisateur est l'auteur de la réponse
  if (answer.userId !== user.id) {
    return;
  }
```

with:

```ts
  // The author, or an admin. Moderators delete answers, they do not rewrite them.
  assertCan(ctx, "answer:update", { ownerUserId: answer.userId });
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run "src/app/[locale]/(app)/channels"`
Expected: 9 passed.

- [ ] **Step 5: Gate the answer buttons on the channel page** — `src/app/[locale]/(app)/channels/[id]/page.tsx`

Add `import { can } from "@/lib/auth/policy";`. Change line 28 to `const ctx = await requireUser();` and line 33 to `members: { some: { userId: ctx.user.id } },`. The membership filter stays: viewing a channel is not an `Action`, so it is out of scope (Review Focus 5).

Replace line 158 (`{answer.userId === user.id && (`) with:

```tsx
                  {/* answer:delete covers everyone answer:update does (the author, an admin)
                      plus this channel's moderators, so it gates the whole group */}
                  {can(ctx, "answer:delete", { channelId: channel.id, ownerUserId: answer.userId }) && (
```

Wrap the existing edit link (lines 160–179, from `<Link` with `href={`/channels/${channel.id}/answers/${answer.id}/edit`}` to its `</Link>`) in a condition. Put this line directly above its `<Link`:

```tsx
                      {can(ctx, "answer:update", { ownerUserId: answer.userId }) && (
```

and this line directly below its `</Link>`:

```tsx
                      )}
```

Then indent the 20 lines in between by two more spaces. Nothing inside the link changes.

- [ ] **Step 6: Gate the answer edit page** — `src/app/[locale]/(app)/channels/[id]/answers/[answerId]/edit/page.tsx`

Add `import { can } from "@/lib/auth/policy";`. Change line 36 to `const ctx = await requireUser();`. Delete the `member` lookup and its `if` (lines 45–50): `modifAnswerUser` never required a membership, and the page now asks the same question as the action. Replace line 56 with:

```tsx
  // The same check as modifAnswerUser.
  if (!answer || !can(ctx, "answer:update", { ownerUserId: answer.userId })) {
```

- [ ] **Step 7: Lint and typecheck**

Run: `npx eslint "src/app/[locale]/(app)/channels" && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/channels/channel-policy.test.ts" "src/app/[locale]/(app)/channels/[id]/actions.ts" "src/app/[locale]/(app)/channels/[id]/page.tsx" "src/app/[locale]/(app)/channels/[id]/answers"
git commit -m "feat(channels): answers authorize with assertCan; moderators delete answers in their channel"
```

---

### Task 4: dropped

Dropped by decision 4: `createChannel`, `joinChannel` and `requestJoinChannel` stay as they are. Their `assertCan` could never refuse a signed-in user. The number is kept so that the references to Tasks 5 and 6 stay valid.

---

### Task 5: Verification (5.1–5.3) and docs

**Files:** `docs/testing-auth.md`, `CLAUDE.md`, `handoff/WORKLOG.md`, `docs/plans/2026-09-21-rasiol-modules-roadmap.md`

- [ ] **Step 1: 5.1 — no inline authorization left**

Run: `grep -rnE 'role [!=]== "MODERATOR"|role: "MODERATOR"|createdBy !==' "src/app/[locale]/(app)/channels"`
Expected: exactly these four hits, none of them an authorization check:
- `[id]/actions.ts` `if (membership.role === "MODERATOR")` in `leaveChannel`: a business rule (a moderator cannot leave, so a channel is not emptied of moderators); the roadmap keeps `leaveChannel` unchanged.
- `create/action.ts` `role: "MODERATOR"` inside `members: { create: … }`: the creator becomes the moderator; a write, not a check.
- `page.tsx` (the `/channels` list) twice, `channel.members[0]?.role === "MODERATOR"`: display of the options menu, moved to roadmap task 6.2.

- [ ] **Step 2: The whole suite and the build gates**

Run: `npm test`, then `npm run build && npm run typecheck`, then `npm run lint`, then `npm run i18n:check`.
Expected: `npm test` 206 passed across 17 files (197 + 9). If the DB tests fail with *could not locate the Query Engine*, apply `CLAUDE.md`'s *Prisma engine flips* fix and rerun. Build and typecheck green. Lint 0 errors, 0 warnings. `i18n:check` the same 5 unused keys as before (no key added or removed).

- [ ] **Step 3: 5.3 and the pages, by hand** — add **B12** to `docs/testing-auth.md`, after B11, then run it

Start from a fresh seed (`npm run db:reset`, which destroys local data and re-seeds), and take the channel ids from the URLs. Every login uses `motdepasse123`.

```markdown
### B12. The policy in the channels (phase 5)

Seed: *Assurance auto* is moderated by Amir (members Adrien, Lina, Karim; answers by Adrien and Karim). *Carte d'identité* is moderated by Syu (members Alexandre, Lina). *Impôts* is moderated by Alexandre. Rasiol is the ADMIN.

| As | Action | Expected |
|---|---|---|
| lina (member of *Assurance auto*) | open `/fr/channels/<auto>/kick`, `/edit`, `/delete`, `/requests`, `/invite` | 404 on each (5.3: a plain member is refused) |
| amir (moderator of *Assurance auto*) | the channel page | a delete button (no edit) on Adrien's and Karim's answers; delete Karim's: it disappears |
| amir | on `/fr/channels/<auto>/kick`, change the hidden `channelId` of **Karim's** form to *Impôts*' id in DevTools (Karim is in both channels), then click *Kick* | refused (5.3: cross-channel): Next's error overlay `Forbidden: channel:moderate` and one console error, expected only for a forged request; Karim stays in both channels |
| rasiol (ADMIN) | in `/fr/admin/users`, delete Syu (creator and only moderator of *Carte d'identité*); then open `/fr/channels/<identite>/kick` and kick Lina | she disappears (5.3: an admin moderates a channel with no moderator, §C-19) |
| rasiol | open `/fr/channels/<identite>/edit` and `/delete` | both pages open: no moderator and no creator are left, so only an admin may |
| any | `select actor."displayName", a.action, target."displayName", a."channelId" from "AuditLog" a left join "User" actor on actor.id = a."actorUserId" left join "User" target on target.id = a."targetId" order by a."createdAt" desc limit 5;` | newest first: `channel:kick` (Rasiol, Lina), `user:delete` (Rasiol, empty target: Syu is gone), `answer:delete` (Amir); no row for the forged kick (5.2) |
| any | the pages above at 375, 768 and 1440 px | no sideways scroll; the console stays empty except for the forged submit (graded) |

Afterwards, `npm run db:reset` restores the seed.
```

Also add a row to the A1 table (`channel-policy.test.ts`: *a plain member is refused every moderation action; a moderator of another channel cannot kick there; an admin kicks in a channel with no moderator; a member cannot edit a channel, a moderator who is not the creator can; that moderator cannot delete it, the creator can; a member cannot delete someone else's answer, a moderator can; a non-member cannot post; a moderator cannot rewrite someone else's answer; every privileged action writes one `AuditLog` row, once, after it happened. Uses the real DB.*) and update A1's counts from the Step 2 output.

- [ ] **Step 4: Update the docs**

- `CLAUDE.md`: *Policy and audit*: the channel actions and pages now call `assertCan` / `can` (phase 5). *Routes → `(app)/channels/`*: replace "Every check is inline … a refusal is a silent `return`" with the new state (authorization throws `ForbiddenError`, validation still returns). *Workflow → roadmap*: phase 5 in PR. Test counts.
- The roadmap: phase 5's status line and an *As built* note (PR number, commits, the departures table above).
- `handoff/WORKLOG.md`: a *Recent* entry with the hashes and the checks actually run, and *Where we stopped*.

- [ ] **Step 5: Commit (with Rasiol's go-ahead)**

```bash
git add docs/testing-auth.md CLAUDE.md handoff/WORKLOG.md docs/plans/2026-09-21-rasiol-modules-roadmap.md
git commit -m "docs: phase 5 test guide (B12), status and worklog"
```

---

### Final review (before Task 6)

One fresh reviewer, on the most capable model, reads the whole branch (`git merge-base main HEAD`..`HEAD`) against this plan and the roadmap's phase 5, with the *Review Focus* section above verbatim. The reviewer only reports; it changes nothing.

- [ ] **Step 1: Run the review** and grade each finding by what a user would get if it shipped.
- [ ] **Step 2: Fix Critical and Important findings in one pass.** For each: a test that reproduces it fails first, then passes, then `npm test` is green again. Minor findings are listed for Rasiol, not fixed.
- [ ] **Step 3: Commit the fixes (with Rasiol's go-ahead)**, and add the findings and the fixes to the worklog.

---

### Task 6: The PR, then Amir

- [ ] **Step 1: Push and open the PR**

`gh` returned 401 on 2026-10-14: run `gh auth login` first, or open the PR from the GitHub page.

```bash
git push -u origin feat/channel-policy
```

Title: `feat(channels): channel actions and pages go through the policy (phase 5)`. Tag Amir as reviewer. The description has three parts.

**What changed:** each channel action authorizes with `assertCan()` and refuses with a `ForbiddenError` (validation still returns silently). Each privileged one writes one `AuditLog` row after it happened. Each management page asks `can()` the same question as its form.

**Behaviour changes, for Amir to confirm (decision 2):**
- Editing a channel: from *the creator* to *any moderator of that channel, or an admin*.
- Deleting a channel: from *any moderator* to *the creator, or an admin*.
- Moderators can delete any answer in their own channel (and that is audited).
- Admins moderate every channel (kick, requests, invite, edit, delete, answers) even without a membership; a channel left without a moderator (§C-19) is no longer frozen. They reach those pages by URL: the channel page itself still 404s for a non-member (viewing a channel is not an `Action`), and `/channels` lists only their own channels.
- The kick page hides *Kick* on moderators and on yourself.
- The answer edit page no longer requires a membership, matching `modifAnswerUser`, which never did.
- Admins can rewrite anyone's answer (policy tier 1); since the final review it is audited as `answer:update`. Admins can also post in any channel and read any answer through its edit page, by URL or a forged form. A non-member admin is sent back to `/channels` after an edit, because the channel page 404s for them.

**Not changed, noted for Amir:** the invite page lists every user's email to any moderator (`getAllUsers`), a privacy issue; most `revalidatePath("/channels…")` calls are bare paths and match nothing under `[locale]` (and `requests/action.ts` omits `(app)`); a double click on *Accept* (`acceptJoinRequest`) or *Request to join* (`requestJoinChannel`) hits a unique constraint and returns a 500; the kick page prints the raw role (`MEMBER`) untranslated; `/channels/page.tsx:218` has a hardcoded `the text after` label on the requests link; `join/page.tsx:60` labels the private-channel button with the literal text `requestJoinChannel` (and `className="..."`); the `/channels` options menu still reads `role === "MODERATOR"` and must move to `can()` in phase 6, once promotion exists.

End the description with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 2: Message Amir** (decision 2: after the PR)

A short message with the PR link, the *Behaviour changes* list above, and a question: do the edit/delete rules match what he intended? If he wants *any moderator may delete*, that is a whole-team change to `can()` (`channel:delete` would join `MODERATOR_ACTIONS`), not a change in his file.
