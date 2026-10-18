# Phase 6 — Channel Role Management (C14b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin promotes a channel member to moderator, or demotes a moderator, from the channel's member list; the change is audited and applies on the target's next request; the `/channels` menu offers each user only the links their role allows.

**Architecture:** No new module, no schema change, no change to `policy.ts` (`channel:manageRoles` already exists and is admin-only, §C-18). One Server Action, `setChannelRole`, is added next to `kickMembers` in Amir's `[id]/kick/action.ts` and follows its shape: validation returns silently, then `assertCan`, then one `updateMany`, then `writeAudit` only when a row changed. The kick page's existing per-member form gets a second submit button with `formAction={setChannelRole}`. The `/channels` menu replaces its two role-based copies with one menu where each link asks `can()` the same question as the page it opens.

**Tech Stack:** Next.js 16 Server Actions · React 19 (`formAction` on a submit button) · Prisma 6 (`@/generated/prisma/client`) · Vitest against the dev Postgres · `src/lib/auth/policy.ts` · `src/lib/audit.ts` · `next-intl`

**Spec:** [`2026-09-21-rasiol-modules-roadmap.md`](2026-09-21-rasiol-modules-roadmap.md) phase 6 (as edited on 2026-10-18 to match this plan) and §C-18, §C-19, §C-20 · [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md) §7 C14 · [`mespapiers_project_vision.md`](../../mespapiers_project_vision.md) §3 (a moderator is "assigned per channel by an Admin")

**Branch:** `feat/channel-roles`, cut from `main` = `8bf5fcd` (PR #33 merged, 2026-10-16). The files are Amir's (plan §4): tag him on the PR.

## Keep vs. Cut (2026-10-18)

The roadmap's phase 6 was reviewed for overengineering, out-of-scope edge cases and assumptions that do not fit the code on `main`. The roadmap now matches this table.

**Kept**

| Item | Why |
|---|---|
| `setChannelRole`, admin-only through `assertCan(ctx, "channel:manageRoles", { channelId })` | vision §3 and C14: an admin assigns moderators. `channel:manageRoles` is in `ADMIN_ONLY` since phase 3 (§C-18) |
| One `channel:setRole` audit row, `metadata: { role }`, only when a row changed | C6 and the vision: "an audit log behind every privileged action". The same shape as phase 4's `user:setGlobalRole` |
| **No** session invalidation | `validateSessionToken()` re-reads memberships on every request (`session.ts:56`), so the change applies on the target's next request. This is a "do not build", kept so nobody adds one |
| Promote/demote buttons on the kick page, shown only when `can(ctx, "channel:manageRoles", …)` | C14's Done-when needs a UI. The kick page is the only member list |
| The `/channels` menu asks `can()` per link | after a promotion, a moderator is no longer always the creator, and *Delete* is creator-only, so the old menu would offer a link that 404s. One menu replaces the two copied ones, so the file gets shorter |
| The kick page's role label and the menu's *requests* label get message keys (5 keys) | both are on lines this phase rewrites, and hardcoded strings fail review (`MEMBER` printed raw; `the text after`) |
| 3 DB tests in `channel-policy.test.ts` | TDD (`CLAUDE.md`). They pin the admin-only check, the audit, the forged inputs, and the "applies on the next request" claim |
| B13 by hand | the graded demo ("different actions per role") and the 375 / 768 / 1440 check |
| The final whole-branch review | Rasiol kept it in phase 5, where it found 2 Important bugs. This phase changes who holds moderation power |

**Cut**

| Item | Why | Instead |
|---|---|---|
| Refusing to demote a channel's **last** moderator | §C-19 already accepts a channel with none (an admin moderates everywhere and can promote again). Count-then-update races (two demotes at once both see two moderators) unless wrapped in a transaction, and a reachable refusal needs its own i18n error | allowed, recorded as **§C-20**; pinned by Task 1's third test |
| "Neither the action nor the buttons may assume a moderator exists" | nothing counts moderators once the guard is gone | — |
| 6.3's "refused in B (forged form)" | `channel-policy.test.ts` already has *refuses a moderator of one channel who replays a kick with another channel's id*, and B12 runs it by hand. `can()` does not care how the `MODERATOR` row got there | Task 1's test proves the new part: the promotion reaches the target's existing session |
| 6.4, the Helper badge | nothing writes `User.reputation` yet (no vote code; Amir's E10 is not started), so the badge cannot be shown or tested. Rendering it is D14's (Alexandre), per the roadmap's coverage table. "Grants nothing" is phase 3's test | moved to roadmap **phase 7, task 7.5**, as a check. Phase 6 no longer waits on E10 |
| Promoting a user who is not a member (an upsert) | the buttons only list members; an upsert would let a forged form add anyone to a private channel | `updateMany` on the existing membership; a non-member is a no-op |
| A Zod schema module for this form | the form has no typed input and no client component; `kickMembers` validates inline | an inline `MEMBER` / `MODERATOR` check |
| A parse helper shared with `kickMembers` | it would rewrite Amir's tested function to save about 10 lines | `setChannelRole` repeats `kickMembers`' validation, in the same style |
| An admin list of all channels, or another admin path to the member list | `/channels` lists only your channels, and the channel page 404s for non-members, but a public channel is one click to join | B13: the admin joins *Assurance auto* first; the per-link menu then shows them the links |
| Renaming the kick page or its link to "Members" | cosmetic, and it is Amir's | — |
| Stopping a demoted creator from deleting the channel | `channel:delete` is decided by ownership (`ownerUserId: channel.createdBy`, phase 5), not by role. Changing it is a whole-team change to `can()` | recorded in §C-20 |
| Refusing an admin's change to their own channel role | harmless: tier 1 already gives an admin every channel action. `setGlobalRole` refuses self-demotion because it could lock the last admin out; nothing similar exists here | — |
| A realtime event on a role change | `src/lib/realtime/publish.ts` is a no-op stub | — |

## Global Constraints

- Import Prisma from `@/generated/prisma/client`, never `@prisma/client`. Use the `prisma` singleton from `src/lib/db.ts`.
- `policy.ts` and the `Action` union do not change: changing them changes a published interface (whole-team decision).
- Validation failures (bad id, unknown role) keep their silent `return`. Authorization is `assertCan`, which throws `ForbiddenError`.
- Every user-visible string is a `next-intl` key. This plan adds exactly 5 keys: `channels.kick.{member, moderator, promote, demote}` and `channels.home.requests`. Add each to `messages/fr.json` first (it types `t()`), then `en.json` and `es.json`.
- Import `Link` from `@/i18n/navigation`. `notFound` comes from `next/navigation`.
- Zero ESLint warnings. Zero console errors on every route a user reaches without forging a request. Responsive at 375 / 768 / 1440.
- Conventional Commits (`feat(channels): …`). **No commit without Rasiol's go-ahead**; stage by path.
- DB tests hit the real Postgres from `.env`; each creates its own `test-<uuid>@mespapiers.test` users and deletes everything it created (the file's `afterEach` already does).
- Browser checks run on `https://mespapiers.local`, never `localhost`.
- Do not touch lines outside this change. Phase 5's notes for Amir stay open and unchanged: the bare `revalidatePath("/channels…")` calls, the double-click 500s on *Accept* and *Request to join*, `getAllUsers` listing every email on the invite page, the `requestJoinChannel` button label in `join/page.tsx`.

## Review Focus

1. **A forged role** (`ADMIN`, empty, missing): the action returns without a 500, nothing changes, nothing is audited. A raw value would reach Prisma as an invalid enum and throw. Pinned by Task 1, test 2.
2. **A target who is not a member** (a forged `userId`, or a stale page after a kick): no membership is created, nothing is audited. Pinned by Task 1, test 2.
3. **A double click on *Make moderator***: the second call matches no row (`role: { not: role }`) and writes no second audit row. Pinned by Task 1, test 2.
4. **The change reaches a session that already existed**, without a re-login. Pinned by Task 1, test 2: the member's token is minted before the promote and validated after it. Demotion goes through the same re-read; test 3 checks its effect (the demoted creator is refused a kick).
5. **A menu link that 404s**: a promoted moderator who is not the creator must not see *Delete*; a demoted creator still sees it (§C-20). Pages are not unit-tested here, so B13 checks it by hand (Task 4).

---

## File map

| File | Task | Change |
|---|---|---|
| `src/app/[locale]/(app)/channels/channel-policy.test.ts` | 1 | a `channel roles` describe block with 3 DB tests; `setChannelRole` added to an import |
| `channels/[id]/kick/action.ts` | 1 | **adds** `setChannelRole`; `kickMembers` unchanged |
| `channels/[id]/kick/page.tsx` | 2 | promote/demote button per row (admins only); role label translated |
| `channels/page.tsx` | 3 | one menu, each link gated by `can()`; *requests* label translated |
| `messages/{fr,en,es}.json` | 2, 3 | the 5 keys |
| `docs/testing-auth.md`, `CLAUDE.md`, `handoff/WORKLOG.md`, the roadmap | 4 | B13, the A1 row, counts, status |

**Line numbers** refer to the files on `main` (`8bf5fcd`). Each instruction also quotes the code it replaces: go by the quote.

Audit vocabulary:

| Action | `action` | `targetType` | `targetId` | `channelId` | `metadata` |
|---|---|---|---|---|---|
| `setChannelRole` | `channel:setRole` | `User` | target user id | the channel | `{ role }`, the new role |

---

### Task 0: Branch and commit the plan

**Files:** `docs/plans/2026-10-18-c14b-channel-roles.md`, `docs/plans/2026-09-21-rasiol-modules-roadmap.md`, `handoff/WORKLOG.md`, `CLAUDE.md`

- [ ] **Step 1: Cut the branch** (the uncommitted docs come with it)

```bash
git switch -c feat/channel-roles
git status -s
```

Expected: only the four files above. `.env` must not appear.

- [ ] **Step 2: Commit (with Rasiol's go-ahead)**

```bash
git add docs/plans/2026-10-18-c14b-channel-roles.md docs/plans/2026-09-21-rasiol-modules-roadmap.md handoff/WORKLOG.md CLAUDE.md
git commit -m "docs: plan phase 6, cut the last-moderator guard and move the Helper badge to phase 7"
```

---

### Task 1: `setChannelRole` (`channel:manageRoles`)

**Files:**
- Modify: `src/app/[locale]/(app)/channels/[id]/kick/action.ts` (append)
- Test: `src/app/[locale]/(app)/channels/channel-policy.test.ts` (import line 7; append a describe block)

**Interfaces:**
- Consumes: `assertCan(ctx, "channel:manageRoles", { channelId: number })` from `@/lib/auth/policy`; `writeAudit({ actorUserId, action, targetType, targetId, channelId, metadata })` from `@/lib/audit`; `requireUser()` from `@/lib/auth/session`. The test file's helpers `newUser`, `newChannel`, `signInAs`, `form`, `isMember`, `auditRows`, and its `vi.mock` of `requireUser`.
- Produces: `export async function setChannelRole(formData: FormData): Promise<void>` in `[id]/kick/action.ts`. It reads the form fields `channelId` (a positive integer as a string), `userId` and `role` (`"MEMBER" | "MODERATOR"`). Task 2's buttons send exactly these three fields.

- [ ] **Step 1: Write the failing tests**

In `channel-policy.test.ts`, replace the import

```ts
import { kickMembers } from "./[id]/kick/action";
```

with

```ts
import { kickMembers, setChannelRole } from "./[id]/kick/action";
```

Append at the end of the file:

```ts
describe("channel roles (channel:manageRoles)", () => {
  const roleOf = async (channelId: number, userId: string) =>
    (await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } } }))?.role;

  it("refuses a moderator, even in their own channel, and changes nothing", async () => {
    const mod = await newUser();
    const member = await newUser();
    const c = await newChannel({ [mod.id]: "MODERATOR", [member.id]: "MEMBER" }, mod.id);
    await signInAs(mod.id);

    await expect(setChannelRole(form({ channelId: c.id, userId: member.id, role: "MODERATOR" })))
      .rejects.toBeInstanceOf(ForbiddenError);

    expect(await roleOf(c.id, member.id)).toBe("MEMBER");
    expect(await auditRows(c.id)).toEqual([]);
  });

  it("lets an admin who is not a member promote, once, audited; the member's existing session kicks on its next request", async () => {
    const admin = await newUser("ADMIN");
    const creator = await newUser();
    const member = await newUser();
    const other = await newUser();
    const outsider = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [member.id]: "MEMBER", [other.id]: "MEMBER" }, creator.id);
    const { token } = await createSession(member.id);   // the member was signed in before the promote
    await signInAs(admin.id);

    // Forged forms: a role that is not a ChannelRole, a user who is not a member.
    await setChannelRole(form({ channelId: c.id, userId: member.id, role: "ADMIN" }));
    await setChannelRole(form({ channelId: c.id, userId: outsider.id, role: "MODERATOR" }));
    expect(await roleOf(c.id, member.id)).toBe("MEMBER");
    expect(await isMember(c.id, outsider.id)).toBe(false);

    await setChannelRole(form({ channelId: c.id, userId: member.id, role: "MODERATOR" }));
    await setChannelRole(form({ channelId: c.id, userId: member.id, role: "MODERATOR" }));   // a double click

    expect(await roleOf(c.id, member.id)).toBe("MODERATOR");
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({
        actorUserId: admin.id, action: "channel:setRole", targetType: "User", targetId: member.id,
        metadata: { role: "MODERATOR" },
      }),
    ]);

    // No session was invalidated: the member's next request re-reads the memberships.
    vi.mocked(requireUser).mockResolvedValue((await validateSessionToken(token))!);
    await kickMembers(form({ channelId: c.id, userId: other.id }));
    expect(await isMember(c.id, other.id)).toBe(false);
  });

  it("lets an admin demote a channel's last moderator (§C-20), who can then no longer kick", async () => {
    const admin = await newUser("ADMIN");
    const creator = await newUser();
    const member = await newUser();
    const c = await newChannel({ [creator.id]: "MODERATOR", [member.id]: "MEMBER" }, creator.id);
    await signInAs(admin.id);

    await setChannelRole(form({ channelId: c.id, userId: creator.id, role: "MEMBER" }));

    expect(await roleOf(c.id, creator.id)).toBe("MEMBER");
    expect(await auditRows(c.id)).toEqual([
      expect.objectContaining({ actorUserId: admin.id, action: "channel:setRole", targetId: creator.id, metadata: { role: "MEMBER" } }),
    ]);

    await signInAs(creator.id);
    await expect(kickMembers(form({ channelId: c.id, userId: member.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await isMember(c.id, member.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "src/app/[locale]/(app)/channels/channel-policy.test.ts" -t "channel roles"`
Expected: 3 failed, each with `TypeError: setChannelRole is not a function` (the import resolves to `undefined` until Step 3); the file's 11 other tests are skipped by `-t`. If every DB test fails with *could not locate the Query Engine*, apply `CLAUDE.md`'s *Prisma engine flips* fix and rerun.

- [ ] **Step 3: Write the action**

Append to `src/app/[locale]/(app)/channels/[id]/kick/action.ts` (its imports already cover everything used here):

```ts
// Admins only, in any channel (§C-18). Changes an existing membership, never adds one.
export async function setChannelRole(formData: FormData) {
  const channelId = formData.get("channelId");
  const targetUserId = formData.get("userId");
  const role = formData.get("role");

  if (typeof channelId !== "string" || typeof targetUserId !== "string" || !channelId || !targetUserId)
    return;
  // A forged role would reach Prisma as an invalid enum value and throw.
  if (role !== "MEMBER" && role !== "MODERATOR")
    return;

  const channelIdTrim = channelId.trim();
  const targetUserIdTrim = targetUserId.trim();
  if (channelIdTrim.length === 0 || targetUserIdTrim.length === 0)
    return;

  const intChannelId = parseInt(channelIdTrim, 10);
  if (Number.isNaN(intChannelId) || intChannelId <= 0 || String(intChannelId) !== channelIdTrim)
    return;

  const ctx = await requireUser();
  assertCan(ctx, "channel:manageRoles", { channelId: intChannelId });

  // No session is invalidated: validateSessionToken() re-reads memberships on every
  // request. Demoting the last moderator is allowed (§C-20).
  const { count } = await prisma.channelMember.updateMany({
    where: { channelId: intChannelId, userId: targetUserIdTrim, role: { not: role } },
    data: { role },
  });
  // A double click, or a user who is not a member, changes nothing and records nothing.
  if (count > 0)
    await writeAudit({
      actorUserId: ctx.user.id,
      action: "channel:setRole",
      targetType: "User",
      targetId: targetUserIdTrim,
      channelId: intChannelId,
      metadata: { role },
    });

  revalidatePath("/[locale]/(app)/channels/[id]/kick", "page");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "src/app/[locale]/(app)/channels/channel-policy.test.ts"`
Expected: 14 passed (the 11 from phase 5 and the 3 new ones).

- [ ] **Step 5: Prove the admin check is what refuses the moderator**

Comment out the `assertCan(ctx, "channel:manageRoles", …)` line, rerun the Step 4 command: test 1 fails (the promise resolves instead of rejecting). Restore the line, rerun: 14 passed.

- [ ] **Step 6: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/channels/[id]/kick/action.ts" "src/app/[locale]/(app)/channels/channel-policy.test.ts"
git commit -m "feat(channels): let admins set a member's channel role, audited"
```

---

### Task 2: Promote and demote buttons on the member list

**Files:**
- Modify: `src/app/[locale]/(app)/channels/[id]/kick/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json` (`channels.kick`)

**Interfaces:**
- Consumes: `setChannelRole(formData)` from Task 1, which reads `channelId`, `userId` and `role`. The row's form already carries the hidden `channelId` and `userId`; the button adds `role` through its `name` / `value` (React builds the form data with the clicked button, `createFormDataWithSubmitter` in `react-dom`).
- Produces: the message keys `channels.kick.member`, `channels.kick.moderator`, `channels.kick.promote`, `channels.kick.demote`.

Pages are not unit-tested in this project; the build, the typecheck (it checks every `t()` key against `fr.json`) and B13 cover this task.

- [ ] **Step 1: Add the keys, `fr.json` first**

In `messages/fr.json`, replace

```json
    "kick": {
      "back": "← Retour aux channels",
      "membersCount": "{count, plural, one {# membre} other {# membres}}",
      "kick": "Retirer"
    },
```

with

```json
    "kick": {
      "back": "← Retour aux channels",
      "membersCount": "{count, plural, one {# membre} other {# membres}}",
      "kick": "Retirer",
      "member": "membre",
      "moderator": "modérateur",
      "promote": "Nommer modérateur",
      "demote": "Repasser membre"
    },
```

In `messages/en.json`, the same block becomes:

```json
    "kick": {
      "back": "← Back to channels",
      "membersCount": "{count, plural, one {# member} other {# members}}",
      "kick": "Remove",
      "member": "member",
      "moderator": "moderator",
      "promote": "Make moderator",
      "demote": "Make member"
    },
```

In `messages/es.json`:

```json
    "kick": {
      "back": "← Volver a los canales",
      "membersCount": "{count, plural, one {# miembro} other {# miembros}}",
      "kick": "Expulsar",
      "member": "miembro",
      "moderator": "moderador",
      "promote": "Nombrar moderador",
      "demote": "Volver a miembro"
    },
```

- [ ] **Step 2: Import the action and ask the policy once**

In `kick/page.tsx`, replace

```tsx
import { kickMembers } from "./action";
```

with

```tsx
import { kickMembers, setChannelRole } from "./action";
```

and replace

```tsx
  if (!can(ctx, "channel:moderate", { channelId: id })) notFound();
```

with

```tsx
  if (!can(ctx, "channel:moderate", { channelId: id })) notFound();
  // The same check as setChannelRole: admins only (§C-18).
  const canManageRoles = can(ctx, "channel:manageRoles", { channelId: id });
```

- [ ] **Step 3: The role label and the buttons**

Replace

```tsx
                <p className="mt-1 text-xs text-zinc-400">{membre.role}</p>
              </div>
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

with

```tsx
                <p className="mt-1 text-xs text-zinc-400">
                  {t(membre.role === "MODERATOR" ? "moderator" : "member")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {/* Same form, other action: the button's name and value add the new role. */}
                {canManageRoles && (
                  <button
                    type="submit"
                    formAction={setChannelRole}
                    name="role"
                    value={membre.role === "MODERATOR" ? "MEMBER" : "MODERATOR"}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {t(membre.role === "MODERATOR" ? "demote" : "promote")}
                  </button>
                )}
                {/* kickMembers refuses yourself and moderators: no button that does nothing */}
                {membre.role === "MEMBER" && membre.userId !== ctx.user.id && (
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    {t("kick")}
                  </button>
                )}
              </div>
```

- [ ] **Step 4: Gates**

Run: `npm run build && npm run typecheck`, then `npx eslint "src/app/[locale]/(app)/channels/[id]/kick/page.tsx"`, then `npm run i18n:check`.
Expected: build and typecheck green; 0 lint problems; `i18n:check` shows the same 5 unused keys as on `main` (the 4 new keys are used, none is missing from `en` / `es`). If `npm run build` fails on a stale `.next/dev/types`, delete that folder and rerun.

- [ ] **Step 5: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/channels/[id]/kick/page.tsx" messages/fr.json messages/en.json messages/es.json
git commit -m "feat(channels): promote and demote buttons on the member list, translated roles"
```

---

### Task 3: The `/channels` menu asks `can()` per link

**Files:**
- Modify: `src/app/[locale]/(app)/channels/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`, `messages/es.json` (`channels.home`)

**Interfaces:**
- Consumes: `can()` from `@/lib/auth/policy`; `getUserChannels()` returns each channel's scalar fields (its `include` keeps them), so `channel.createdBy` and `channel.isPrivate` are available. Each link asks the same question as its page: invite and requests `channel:moderate` (private channels only, as before), delete `channel:delete` with `ownerUserId: channel.createdBy`, edit `channel:update`, kick `channel:moderate`. *Leave* keeps `leaveChannel`'s own rule (a moderator cannot leave).
- Produces: the message key `channels.home.requests`.

Behaviour, by who opens the menu: a creator who moderates sees exactly what they saw before. A promoted moderator sees everything except *Delete*. An admin who is a member sees every link and *Leave*. A demoted creator sees *Delete* and *Leave* (§C-20). A plain member sees *Leave*. No one gets an empty menu, because every moderator can edit and everyone else can leave.

- [ ] **Step 1: Add the key, `fr.json` first**

In `channels.home`, replace `"leave": "Quitter",` with `"leave": "Quitter",` followed by `"requests": "Demandes d'adhésion",` on the next line. In `en.json`: after `"leave": "Leave",` add `"requests": "Join requests",`. In `es.json`: after `"leave": "Salir",` add `"requests": "Solicitudes de acceso",`. (The same wording as each locale's `channels.requests.title`.)

- [ ] **Step 2: The context and the import**

Replace

```tsx
import { leaveChannel } from "./[id]/actions";
```

with

```tsx
import { leaveChannel } from "./[id]/actions";
import { can } from "@/lib/auth/policy";
```

and replace

```tsx
  const { user } = await requireUser();
  const channelsMember = await getUserChannels(user.email);
```

with

```tsx
  const ctx = await requireUser();
  const channelsMember = await getUserChannels(ctx.user.email);
```

- [ ] **Step 3: One menu**

Replace everything between `</summary>` and `</details>` (from `{channel.members[0]?.role === "MODERATOR" &&` down to the `)}` that closes the leave form) with:

```tsx
                {/* Each link asks can() the same question as the page it opens. Since phase 6
                    a moderator need not be the creator, so Delete is not every moderator's. */}
                <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {channel.isPrivate && can(ctx, "channel:moderate", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/invite`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                        />
                      </svg>
                      {t("invite")}
                    </Link>
                  )}
                  {can(ctx, "channel:delete", { channelId: channel.id, ownerUserId: channel.createdBy }) && (
                    <Link
                      href={`/channels/${channel.id}/delete`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      {t("delete")}
                    </Link>
                  )}
                  {can(ctx, "channel:update", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/edit`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                      {t("edit")}
                    </Link>
                  )}
                  {channel.isPrivate && can(ctx, "channel:moderate", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/requests`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <circle cx="9" cy="8" r="3.5" />
                        <path
                          strokeLinecap="round"
                          d="M2.5 20a6.5 6.5 0 0 1 13 0"
                        />
                        <path strokeLinecap="round" d="M19 8v6M16 11h6" />
                      </svg>
                      {t("requests")}
                    </Link>
                  )}
                  {can(ctx, "channel:moderate", { channelId: channel.id }) && (
                    <Link
                      href={`/channels/${channel.id}/kick`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                        />
                      </svg>
                      {t("kick")}
                    </Link>
                  )}
                  {/* leaveChannel refuses moderators: no button that does nothing */}
                  {channel.members[0]?.role !== "MODERATOR" && (
                    <form action={leaveChannel}>
                      <input type="hidden" name="channelId" value={channel.id} />
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="size-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                          />
                        </svg>
                        {t("leave")}
                      </button>
                    </form>
                  )}
                </div>
```

- [ ] **Step 4: Gates**

Run: `npm run build && npm run typecheck`, then `npm run lint`, then `npm run i18n:check`.
Expected: green; 0 lint problems; `i18n:check` the same 5 unused keys. `wc -l "src/app/[locale]/(app)/channels/page.tsx"` reports fewer lines than on `main` (343): the copied block is gone.

- [ ] **Step 5: Commit (with Rasiol's go-ahead)**

```bash
git add "src/app/[locale]/(app)/channels/page.tsx" messages/fr.json messages/en.json messages/es.json
git commit -m "feat(channels): the channel menu asks can() for each link"
```

---

### Task 4: Verification (6.1–6.3) and docs

**Files:** `docs/testing-auth.md`, `CLAUDE.md`, `handoff/WORKLOG.md`, `docs/plans/2026-09-21-rasiol-modules-roadmap.md`

- [ ] **Step 1: No authorization reads a role**

Run: `grep -rnE 'role [!=]== "MODERATOR"|role: "MODERATOR"|createdBy !==' "src/app/[locale]/(app)/channels"`
Expected: 6 hits, none of them an authorization check:
- `[id]/actions.ts`, `leaveChannel`: `membership.role === "MODERATOR"` (the business rule: a moderator cannot leave);
- `create/action.ts`: `role: "MODERATOR"` (the creator's membership, a write);
- `page.tsx`: `channel.members[0]?.role !== "MODERATOR"` (shows *Leave*, mirroring that rule);
- `[id]/kick/page.tsx`, three times: the role label, the button's `value`, the button's label (display).

- [ ] **Step 2: The whole suite and the gates**

Run: `npm test`, then `npm run build && npm run typecheck`, then `npm run lint`, then `npm run i18n:check`.
Expected: `npm test` 211 passed (17 files: 208 + 3). Build and typecheck green. Lint 0 errors, 0 warnings. `i18n:check` the same 5 unused keys as on `main`.

- [ ] **Step 3: B13 by hand** — add it to `docs/testing-auth.md` after B12, then run it

```markdown
### B13. Channel roles (phase 6)

Start from a fresh seed (`npm run db:reset`). *Assurance auto* (id 1, public) is moderated by its creator Amir; Adrien, Lina and Karim are members. Rasiol is the ADMIN and a member of no channel. Every login uses `motdepasse123`. Use two browsers (or a private window) so Adrien stays signed in while Rasiol promotes him.

| As | Action | Expected |
|---|---|---|
| adrien | sign in, open `/fr/channels`, then ⋯ on *Assurance auto* | *Quitter* only |
| rasiol (ADMIN) | `/fr/channels/join`, join *Assurance auto*; then `/fr/channels`, ⋯ | *Supprimer*, *Modifier*, *Retirer un membre* and *Quitter* (an admin passes every `can()`) |
| rasiol | ⋯ → *Retirer un membre* | each row shows *membre* or *modérateur*; every row has *Nommer modérateur* or *Repasser membre*; Amir's has *Repasser membre* |
| rasiol | *Nommer modérateur* on Adrien | his row now says *modérateur* and offers *Repasser membre*; his *Retirer* disappears |
| adrien (still signed in from row 1) | reload `/fr/channels`, ⋯ | *Modifier* and *Retirer un membre*, no *Supprimer* (he is not the creator) and no *Quitter* (6.2). No re-login was needed (6.1) |
| adrien | *Retirer un membre*, then *Retirer* on Lina | she disappears (6.3); no promote/demote buttons on his page (§C-18) |
| amir | open `/fr/channels/1/kick` | *Retirer* on members, no promote/demote buttons: a moderator does not manage roles (§C-18) |
| rasiol | *Repasser membre* on Adrien, then on Amir | both work, even though the channel is left with no moderator (§C-20) |
| amir | reload `/fr/channels`, ⋯ | *Supprimer* and *Quitter*: he is still the creator (§C-20) |
| any | `select actor."displayName", a.action, target."displayName", a.metadata from "AuditLog" a left join "User" actor on actor.id = a."actorUserId" left join "User" target on target.id = a."targetId" order by a."createdAt" desc limit 4;` | newest first: `channel:setRole` (Rasiol, Amir, `{"role": "MEMBER"}`), `channel:setRole` (Rasiol, Adrien, `{"role": "MEMBER"}`), `channel:kick` (Adrien, Lina), `channel:setRole` (Rasiol, Adrien, `{"role": "MODERATOR"}`) |
| any | the kick page and the menu at 375, 768 and 1440 px | no sideways scroll (the name truncates beside the two buttons); the console stays empty (graded) |

Afterwards, `npm run db:reset` restores the seed.
```

Also: in the A1 table, extend the `channel-policy.test.ts` row with *phase 6: a moderator cannot change a channel role; an admin promotes once, audited, a forged role or a non-member changes nothing, and the promoted member's existing session moderates on its next request; an admin may demote the last moderator, who then cannot kick*. Update A1's counts from the Step 2 output (208 → 211; the auth part 90 → 93 tests).

- [ ] **Step 4: Update the docs**

- `CLAUDE.md`, *Routes → `(app)/channels/`*: add `channel:setRole` to the audit list; replace "The `/channels` options menu still reads `role === "MODERATOR"` for display (roadmap task 6.2)" with "The `/channels` options menu asks `can()` per link (phase 6); admins promote and demote moderators from `[id]/kick` (`setChannelRole`)". *Workflow → roadmap*: phase 6 in PR. Test counts (`49 of 208` / `159 pure` in *Commands* become `52 of 211` / `159`).
- The roadmap: phase 6's status line and an *As built* note (PR number, commits, the gates actually run).
- `handoff/WORKLOG.md`: a *Recent* entry with the hashes and the checks actually run, and *Where we stopped*.

- [ ] **Step 5: Commit (with Rasiol's go-ahead)**

```bash
git add docs/testing-auth.md CLAUDE.md handoff/WORKLOG.md docs/plans/2026-09-21-rasiol-modules-roadmap.md
git commit -m "docs: phase 6 test guide (B13), status and worklog"
```

---

### Final review (before Task 5)

One fresh reviewer, on the most capable model, reads the whole branch (`git merge-base main HEAD`..`HEAD`) against this plan and the roadmap's phase 6, with the *Review Focus* section above verbatim. The reviewer only reports; it changes nothing.

- [ ] **Step 1: Run the review** and grade each finding by what a user would get if it shipped.
- [ ] **Step 2: Fix Critical and Important findings in one pass.** For each: a test that reproduces it fails first, then passes, then `npm test` is green again. Minor findings are listed for Rasiol, not fixed.
- [ ] **Step 3: Commit the fixes (with Rasiol's go-ahead)**, and add the findings and the fixes to the worklog.

---

### Task 5: The PR, then Amir

- [ ] **Step 1: Push and open the PR**

`gh` returned 401 on 2026-10-14: run `gh auth login` first, or open the PR from the GitHub page.

```bash
git push -u origin feat/channel-roles
```

Title: `feat(channels): admins promote and demote channel moderators (phase 6)`. Tag Amir as reviewer. The description has three parts.

**What changed:** `setChannelRole` in `[id]/kick/action.ts`: admins only (`channel:manageRoles`, §C-18), changes an existing membership, writes one `channel:setRole` audit row when the role changed. The member list (`/channels/[id]/kick`) shows *Make moderator* / *Make member* to admins. The `/channels` menu asks `can()` for each link.

**Behaviour changes, for Amir to confirm:**
- The kick page prints the role translated (*membre* / *modérateur*) instead of `MEMBER`.
- The `/channels` menu: a moderator who is not the creator no longer sees *Delete* (the page would 404); an admin who is a member sees every management link plus *Leave*; a demoted creator sees *Delete* and *Leave*, because deleting is the creator's right, not the moderator's (§C-20). The *requests* link's label is translated (it read `the text after`).
- Demoting a channel's last moderator is allowed (§C-20): an admin can still moderate the channel and promote someone else.

**Not changed, still open from phase 5:** the bare `revalidatePath("/channels…")` calls; the double-click 500s on *Accept* and *Request to join*; the invite page listing every user's email; the `requestJoinChannel` label in `join/page.tsx`.

End the description with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 2: Message Amir** with the PR link and the *Behaviour changes* list, and one question: is *Delete* staying with the creator after a demotion what he wants? If not, that is a whole-team change to `can()`, not a change in his files.
