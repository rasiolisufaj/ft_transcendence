# Testing the auth work (roadmap phases 0–4)

How to check the auth code yourself: the session core, signup / login / logout, the route guard, the permission policy, the audit log and the admin surface. It covers roadmap tasks 0.4, 1.1–1.3, 2.1–2.4, 3.1–3.3 and 4.1–4.3 (C1, C2, C3, C4, C6, C14 for global roles, and part of C5 and C11 in `PROJECT_PLAN.md` §7).

There are two parts:

- **Part A:** the automated tests. They run on the host and take about 3 seconds.
- **Part B:** a manual walkthrough in the browser against the Docker stack. It covers what unit tests can't reach: cookies, redirects and CSRF.

Do Part A first. The host and the container each need their own Prisma engine (see "Prisma engine flips" in `CLAUDE.md`), so you switch back to Docker between the two parts.

**Before you start:** the stack must be up (`docker compose up`) and migrated (`npm run db:migrate`).

---

## Part A: automated tests (host)

### A1. Run them

```bash
# Only needed if you see: could not locate the Query Engine for runtime "debian-openssl-3.0.x"
docker exec mespapiers_web chown -R 1000:1000 /app/src/generated
npm run db:generate

npm test                                                                    # everything
npx vitest run src/lib/auth src/lib/audit.test.ts "src/app/[locale]/(auth)" "src/app/[locale]/(app)/admin" "src/app/[locale]/(app)/channels" src/lib/users src/lib/files "src/app/[locale]/(app)/users" src/app/api/users src/app/api/auth --reporter=verbose    # auth and profile only
```

Expected: `npm test` reports **276 passed** (27 files). The auth and profile part is 16 files and 129 tests; the rest is the other modules' code. The verbose run prints each test name with a ✓. If `npm test` dies with exit 137 and no output, memory ran out: run `npx vitest run --maxWorkers=1`.

| File | What it proves |
|---|---|
| [password.test.ts](../src/lib/auth/password.test.ts) | argon2 never stores plaintext, salts every hash differently, rejects a wrong password, and returns `false` on a corrupt hash instead of crashing |
| [session.test.ts](../src/lib/auth/session.test.ts) | tokens are random and ≥128 bits; only the SHA-256 is stored; expired sessions are rejected and deleted; the expiry never slides; logout kills one session or all of them; channel memberships load; `lastSeenAt` is written when unset or older than a minute, and a fresh one is left alone. Uses the real DB. |
| [schemas.test.ts](../src/lib/auth/schemas.test.ts) | the signup and login rules; every error key exists in fr, en and es |
| [login/actions.test.ts](<../src/app/[locale]/(auth)/login/actions.test.ts>) | the action returns the schema's errors; 6 failures lock an email for 15 minutes |
| [oauth.test.ts](../src/lib/auth/oauth.test.ts) | phase 8: the PKCE challenge matches RFC 7636's Appendix B pair; `resolveGoogleUser` creates a user with no password and its Google account, then signs in to the same user next time; it links an existing account even when Google sends the email in capitals (one user), and the link drops that account's password and ends every session opened before it (signup never verifies emails, so the password may be an impostor's); it refuses an email Google has not verified and links nothing; a new user with no Google name is named after the email's local part, and a 70-character name is cut to 50, between characters, never inside an emoji. Uses the real DB. |
| [api/auth/google/start/route.test.ts](../src/app/api/auth/google/start/route.test.ts) | the start route sends the browser to Google with the client id, the redirect URI, an S256 challenge of the cookie's verifier and the cookie's state; the `mp_oauth` cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, 10 minutes, on `/api/auth/google` only; with no Google client configured it goes back to `/login?error=oauth` and sets no cookie |
| [api/auth/google/callback/route.test.ts](../src/app/api/auth/google/callback/route.test.ts) | a state that does not match its cookie is refused before Google is called; a sign-in exchanges the code with the cookie's verifier, opens a session and clears the cookie, and the same callback replayed is refused without calling Google; a cancelled consent, Google being down and Google answering an HTML error page all end on `/login?error=oauth`, not a 500; the server log says why Google refused a code (`invalid_grant`). Uses the real DB. |
| [policy.test.ts](../src/lib/auth/policy.test.ts) | `can()` denies unknown actions, even to an admin; an admin can do everything except touch another user's documents (the vault is owner-only, even for an admin); a moderator acts only in their own channel, and moderation is never granted by ownership; owners act only on their own rows; posting needs a membership; reputation grants nothing; `user:manage` and `channel:manageRoles` are admin-only, even on your own account. Plus the C4 truth table: one row per `Action` (23) with the resource its caller passes and the answer for admin, moderator, member, owner and stranger; a new `Action` without a row fails the typecheck |
| [admin/users/actions.test.ts](<../src/app/[locale]/(app)/admin/users/actions.test.ts>) | a non-admin cannot change a role or delete a user; an admin cannot demote or delete themselves; a role change ends that user's sessions; every change writes one `AuditLog` row; a role other than USER/ADMIN is refused; a double click or a stale page (user already gone, role already set) changes nothing and does not throw. Uses the real DB. |
| [channels/channel-policy.test.ts](<../src/app/[locale]/(app)/channels/channel-policy.test.ts>) | phase 5, the policy in the channel actions: a plain member is refused every moderation action; a moderator of another channel cannot kick there; an admin kicks in a channel with no moderator; a member cannot edit a channel, a moderator who is not the creator can; that moderator cannot delete it, the creator can; a member cannot delete someone else's answer, a moderator can; a non-member cannot post; a moderator cannot rewrite someone else's answer, an admin's rewrite is audited; a non-member admin is sent back to `/channels` after an edit; every privileged action writes one `AuditLog` row, once, after it happened. Phase 6: a moderator cannot change a channel role; an admin promotes once, audited, a forged role or a non-member changes nothing, and the promoted member's existing session moderates on its next request; an admin may demote the last moderator, who then cannot kick or delete; a moderator, the creator included, can leave a channel, and a creator who left cannot delete it. Uses the real DB. |
| [audit.test.ts](../src/lib/audit.test.ts) | `writeAudit()` records the actor, action, target and channel; a failed write is logged and never throws. Uses the real DB. |
| [users/profile.test.ts](../src/lib/users/profile.test.ts) | phase 12: `isUserId` accepts a cuid and refuses a NUL byte, a path and an empty string; `isOnline` is true at 4 min 59 s and false at 5 min 1 s or for someone never seen; `relationBetween` is `friend` for an accepted request, `none` then `pending` once a request is sent, and `blocked` seen from the blocked side too. Uses the real DB. |
| [users/[id]/actions.test.ts](<../src/app/[locale]/(app)/users/[id]/actions.test.ts>) | `updateProfile` renames the caller only, even with another user's id in the form, and refuses a name that is one letter once trimmed; `addFriendFromProfile` adds nothing and does not throw when the profile's owner was deleted meanwhile; `uploadAvatar` stores a png and a second upload replaces it (one row), and refuses a text file or a PDF named `.png`, an oversized file and an empty one, storing nothing. Uses the real DB. |
| [api/users/[id]/avatar/route.test.ts](<../src/app/api/users/[id]/avatar/route.test.ts>) | the avatar route answers 401 without a session, 404 without an avatar or for a malformed id, and serves the stored bytes with their type, `nosniff` and `private, no-store`. Uses the real DB. |
| [files/sniff.test.ts](../src/lib/files/sniff.test.ts) | `sniffMime` recognises png, jpeg, webp and pdf by their first bytes; an SVG and plain text are `null`. |

To run one test by name: `npx vitest run -t "never extends"`.

### A2. Prove a test really guards something

A test only counts if it fails when the code is wrong. Break the code on purpose, watch the test fail, then undo:

1. In [rate-limit.ts](../src/lib/auth/rate-limit.ts) (moved out of `login/actions.ts` in PR #30), change `return entry.count >= MAX_ATTEMPTS;` to `>`.
   - Run `npx vitest run -t "locks an email"`. Expected: **FAIL**.
2. In [session.ts](../src/lib/auth/session.ts), comment out the `if (row.expiresAt.getTime() <= Date.now()) { … }` block.
   - Run `npx vitest run -t "expired"`. Expected: **FAIL**.
3. In [policy.ts](../src/lib/auth/policy.ts), comment out `if (ADMIN_ONLY.has(action)) return false;`.
   - Run `npx vitest run -t "admin-only"`. Expected: **FAIL**, because a user could now "manage" (promote) their own account.
4. In [audit.ts](../src/lib/audit.ts), replace `console.error("audit write failed", entry.action, error);` with `throw error;`.
   - Run `npx vitest run -t "never throws"`. Expected: **FAIL**.
5. Undo all four edits (`git checkout -- src/` if you have nothing else there). Check that `git diff src/` is empty, then run `npm test` again (99 passed).

### A3. Build gates (graded: zero errors)

```bash
npm run build && npm run typecheck && npm run lint
```

Expected:
- **Build:** a route table where every route is `ƒ`, meaning dynamic. That's normal: the nav reads the session cookie on every page.
- **Typecheck:** prints nothing.
- **Lint:** `0 errors`. The 2 known warnings are in `prisma/seed.ts`.

If the build says `Cannot find module '…/src/app/[locale]/page.js'`, `.next/dev/types` is stale from before the routes moved into `(app)`. Run `rm -rf .next/dev/types` and build again.

### A4. Phase 3 by hand: ask `can()`, write an audit row

Nothing in the app calls `can()` or `writeAudit()` yet (phase 4 and Amir's channel actions will), so you try them from the terminal.

**Ask the policy a question.** No database is involved, so you can edit the user, the action and the resource, then run it again:

```bash
npx tsx -e '
import { can } from "./src/lib/auth/policy.ts";
const me = { user: { id: "me", globalRole: "USER" }, memberships: [{ channelId: 7, role: "MODERATOR" }] };
console.log(can(me, "thread:delete", { channelId: 7, ownerUserId: "someone" }));  // true: I moderate channel 7
console.log(can(me, "thread:delete", { channelId: 8, ownerUserId: "someone" }));  // false: not channel 8
console.log(can(me, "user:manage", { ownerUserId: "me" }));                      // false: admin-only
'
```

Then try `globalRole: "ADMIN"` (all three become `true`) or `role: "MEMBER"` (the first one becomes `false`).

**Write an audit row and look at it.** This uses the database, so it needs the host Prisma engine (A1):

```bash
npx tsx --env-file=.env -e '
import { writeAudit } from "./src/lib/audit.ts";
writeAudit({ actorUserId: null, action: "demo:hello", targetType: "Demo", targetId: "1", channelId: 7, metadata: { note: "my first audit row" } }).then(() => console.log("written"));
'
```

`tsx -e` compiles to CommonJS, so use `.then()`, not a top-level `await`. Then, in `psql` (`docker exec -it mespapiers_db psql -U mespapiers -d mespapiers`):

```sql
select action, "targetType", "targetId", "channelId", metadata from "AuditLog" where action = 'demo:hello';
delete from "AuditLog" where action = 'demo:hello';
```

Expected: one row, with `channelId` stored as the text `7` (roadmap §C-8) and `metadata` as JSON.

**`AUTH_STUB` is gone (task 3.3).** `grep -rn AUTH_STUB src .env.example` prints nothing.

---

## Part B: manual, in the browser

### B0. Setup

```bash
docker restart mespapiers_web          # the container regenerates its own Prisma engine
# after ~20 s, so the host can regenerate later:
docker exec mespapiers_web chown -R 1000:1000 /app/src/generated
```

- Keep a database shell open in a second terminal:

  ```bash
  docker exec -it mespapiers_db psql -U mespapiers -d mespapiers
  ```

- Use a **private window** at **`https://mespapiers.local`**, the name `next.config.ts` allows for dev (`allowedDevOrigins`). Every URL below uses it. It needs `127.0.0.1 mespapiers.local` in the Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`), which WSL picks up too (`getent hosts mespapiers.local`). Accept the self-signed certificate.
- Keep DevTools open, on the **Console** and **Network** tabs.
- After `npm run db:reset` (it wipes the local database, then seeds it), the ten seeded users log in as `<first name in lowercase>@gmail.com` (`amir@gmail.com`, `rasiol@gmail.com`, …) with the dev password **`motdepasse123`**. `rasiol@gmail.com` is the only `ADMIN`; the others are `USER`. Every step below still uses a fresh account, `moi@mespapiers.test`, so that signup is tested too.

### B1. The guard

| Action | Expected |
|---|---|
| Go to `/fr` | You land on **`/fr/login`**. The nav shows *Se connecter* and *Créer un compte*, and no dashboard links. |
| Go to `/es/documents/new` | You land on **`/es/login`**, so the language is kept |
| `curl -k -i https://mespapiers.local/api/documents/1` | **`401`**. Before task 2.4 this returned the seeded user's file to anyone. |

### B2. Signup validation

On `/fr/signup`, try each of these:

| Input | Expected |
|---|---|
| Name `A` | "…au moins 2 caractères", and the field is outlined red |
| Password `short` | "…au moins 8 caractères"; name and email are **kept**, the password is **cleared** |
| Email `pas-un-email` | "Saisissez une adresse e-mail valide." |
| A valid form, email `  Moi@MesPapiers.TEST  ` (with spaces and capitals), password `motdepasse123` | You land on `/fr`, and the nav shows your name and *Se déconnecter* |
| Sign up again with the same email | "Cette adresse e-mail est déjà associée à un compte." |

Then check the database:

```sql
select email, "passwordHash" from "User" where email = 'moi@mespapiers.test';
```

Expected:
- The email is **lowercase with no spaces**, which shows it was normalised.
- The hash starts with **`$argon2id$`**.

### B3. The cookie and session

- **DevTools → Application → Cookies:** `mp_session` has *HttpOnly* ✓, *Secure* ✓, *SameSite Lax*, and expires about 30 days from now.
- **Console:** `document.cookie` does **not** contain `mp_session`, because JavaScript can't read it.
- **Only the hash is stored.** Copy the cookie value, then:

  ```bash
  echo -n 'PASTE_COOKIE_VALUE' | sha256sum
  ```

  ```sql
  select id, "expiresAt" from "Session"
  where "userId" = (select id from "User" where email = 'moi@mespapiers.test');
  ```

  Expected: `Session.id` equals the `sha256sum` output, and the raw cookie value appears nowhere in the table.

### B4. Documents belong to the signed-in user

- Upload a PNG or PDF through the nav's *Ajouter un document*.

  ```sql
  select d.id, u.email from "Document" d join "User" u on u.id = d."ownerId"
  order by d.id desc limit 3;
  ```

  Expected: the new document belongs to **moi@mespapiers.test**, and no demo user was created.

- Test the file route with your cookie:

  ```bash
  curl -k -i -b "mp_session=PASTE_COOKIE_VALUE" https://mespapiers.local/api/documents/YOUR_DOC_ID   # 200
  curl -k -i -b "mp_session=PASTE_COOKIE_VALUE" https://mespapiers.local/api/documents/1             # 404, someone else's
  ```

### B5. Logout invalidates the session on the server

- Click *Se déconnecter*. Expected: you land on `/fr/login`, and the nav switches back to the sign-in links.
- Run the Session query from B3 again. Expected: **0 rows**.
- Replay the **old** cookie: the first curl from B4 now returns **`401`**. A stolen cookie is dead after logout.

### B6. Login and rate limit (C11)

| Action | Expected |
|---|---|
| Right email, wrong password | "Adresse e-mail ou mot de passe incorrect.", and the email is kept |
| An email that doesn't exist | **The same** message, so it doesn't reveal who is registered |
| Right credentials | You land on `/fr`. The Session query shows a row with a **new** id: the session rotates on every login. |
| 6 wrong passwords in a row, then a 7th try | "Trop de tentatives échouées…", and **even the right password is refused** for 15 minutes |

The lock lives in memory, so `docker restart mespapiers_web` clears it. That's by design: there is one web process, so no Redis.

### B7. Expiry

While logged in, age your session in SQL:

```sql
update "Session" set "expiresAt" = now() - interval '1 minute'
where "userId" = (select id from "User" where email = 'moi@mespapiers.test');
```

Reload `/fr`. Expected: you're redirected to `/fr/login`, and the Session row is **deleted**.

### B8. CSRF (C11)

Server Actions rely on Next.js's built-in Origin check (roadmap §C-5). To prove it, replay a real login request from another origin:

1. Log out. In **Network**, submit the login form with the **right** credentials.
2. Right-click the `POST login` request → **Copy → Copy as cURL (bash)**.
3. Count the sessions (query from B3).
4. Paste the copied command in a terminal:
   - add `-k -i`
   - change `-H 'origin: https://mespapiers.local'` to `-H 'origin: https://evil.example'`
   - run it
5. Expected:
   - the curl output starts with `HTTP/1.1 500`
   - `docker logs --tail 5 mespapiers_web` shows `…does not match origin header with value evil.example… Aborting the action.`
   - the session count is **unchanged**
6. **Control:** run the unedited copy. Expected: the session count goes up by 1. That proves the only difference is the Origin check.

After step 4, an idle dev tab may log `Cannot write to a CLOSED writable stream`. That's Next's dev-only debug channel reacting to a request that didn't come from the browser. It doesn't happen in normal use.

### B9. Graded UI checks

- **Languages:** on `/en/login` and `/es/login` the nav and the error messages are translated (*Sign in / Sign out*, *Iniciar sesión / Cerrar sesión*).
- **Responsive:** turn on DevTools' device toolbar (Ctrl+Shift+M) and set widths **375, 768 and 1440**, both signed in and signed out. Expected: no horizontal scrollbar at any width, and the nav wraps instead of overflowing.
- **Keyboard:** with Tab only, you can reach every nav link, the language switcher, *Se déconnecter* and each form field, in a logical order. Enter submits the forms.
- **Console:** no red or yellow messages on any page you visited. The React DevTools info message and the HMR logs are fine.

### B10. A second account can't see or delete your documents (C5)

You need a second account, `autre@mespapiers.test`, signed in **at the same time** as `moi@mespapiers.test`. Private windows of one browser share their cookies, so use a second browser (or a normal window next to your private one).

1. **Setup.**
   - As `moi`: sign in again (B5 logged you out) and copy the new `mp_session` cookie as `MOI_COOKIE`. Keep the document from B4; its id is `YOUR_DOC_ID` (B4 query).
   - As `autre`: sign up, upload any PNG or PDF, and copy its cookie as `AUTRE_COOKIE`. The file appears under *Autres* (`/fr/documents/other`).
2. **The list is owner-scoped.** `autre`'s `/fr/documents/other` shows only `autre`'s file, never `moi`'s.
3. **The file route.**

   ```bash
   curl -k -i -b "mp_session=AUTRE_COOKIE" https://mespapiers.local/api/documents/YOUR_DOC_ID   # 404
   curl -k -i -b "mp_session=MOI_COOKIE" https://mespapiers.local/api/documents/YOUR_DOC_ID     # 200, control
   ```

   It's 404, not 403. The query only searches your own documents, so someone else's id looks exactly like a missing one, and the answer doesn't confirm that it exists (roadmap §C-14).
4. **The delete action.** In `autre`'s window, on `/fr/documents/other`:
   - DevTools → Elements: in the delete button's form, change `<input type="hidden" name="id" value="…">` to `YOUR_DOC_ID`, then click the delete button.
   - Expected: Next's dev error overlay, *Runtime Error · Server · this document does not exist, or is not yours*. The Console shows two red lines (a `500` and the same message); this is the only step in this guide where console errors are expected. `docker logs --tail 5 mespapiers_web` shows the same error, and the query below still lists `moi`'s document.
   - **Control:** reload the page and delete `autre`'s own document normally. Expected: you land on `/fr`, and the query no longer lists that document.

   ```sql
   select d.id, u.email from "Document" d join "User" u on u.id = d."ownerId"
   where u.email in ('moi@mespapiers.test', 'autre@mespapiers.test');
   ```

   The refused delete answers **500**, not 403 or 404, because `deleteDocument` throws a plain `Error` (`src/app/[locale]/action.ts`, Amir's). Nothing is deleted, but the user gets an error screen and a red console.

### B11. The admin surface (phase 4)

Log in as `amir@gmail.com` (USER) in one browser and `rasiol@gmail.com` (ADMIN) in another; both use `motdepasse123` (B0).

| Action | Expected |
|---|---|
| As amir, open `/fr/admin/users`, then `/en/…` and `/es/…` | The translated "Accès refusé" card, the URL unchanged, no *Administration* link in the nav |
| As amir, view the page source (Ctrl+U) and search for `emma@gmail.com` | **Not found.** The page checks `can()` itself; without that, the layout shows the 403 card but the user list still ships in the RSC payload |
| As rasiol, open the account menu (☰ below 768 px) | An *Administration* link, which opens the user table |
| Search `EMM` | Only Emma's row (case-insensitive, on name and email) |
| Your own row | *Vous*, no buttons |
| *Rendre admin* on Amir, then *Retirer admin* | The badge changes each time. In psql, Amir has **no** `Session` row left: a role change signs him out everywhere, so his browser is back on the login page at the next click |
| *Supprimer* on a throwaway account, then **double-click** *Confirmer* | The row disappears; the account and its sessions and documents are gone; one `user:delete` row, and the console stays empty (the second click finds nothing to delete) |
| `select "actorUserId", action, "targetId", metadata from "AuditLog" order by "createdAt" desc limit 3;` | One row per change, newest first: `user:delete`, then two `user:setGlobalRole` with `{"role": "USER"}` and `{"role": "ADMIN"}`, all with rasiol's id as the actor |
| Resize to 375, 768 and 1440 px | No sideways scroll; below 640 px the table keeps the user and the actions, the role badge moves under the email |

### B12. The policy in the channels (phase 5)

Start from a fresh seed (`npm run db:reset`, which destroys local data and re-seeds), and take the channel ids from the URLs (after a reset: 1 *Assurance auto*, 4 *Carte d'identité*, 5 *Impôts*). Every login uses `motdepasse123`.

Seed: *Assurance auto* is moderated by Amir (members Adrien, Lina, Karim; answers by Adrien and Karim). *Carte d'identité* is moderated by Syu (members Alexandre, Lina). *Impôts* is moderated by Alexandre (Karim is a member). Rasiol is the ADMIN.

| As | Action | Expected |
|---|---|---|
| lina (member of *Assurance auto*) | open `/fr/channels/<auto>/kick`, `/edit`, `/delete`, `/requests`, `/invite` | 404 on each (5.3: a plain member is refused) |
| amir (moderator of *Assurance auto*) | the channel page | a delete button (no edit) on Adrien's and Karim's answers; delete Karim's: it disappears |
| amir | on `/fr/channels/<auto>/kick`, change the hidden `channelId` of **Karim's** form to *Impôts*' id in DevTools (Karim is in both channels), then click *Kick* | refused (5.3: cross-channel): Next's error overlay `Forbidden: channel:moderate` and one console error, expected only for a forged request; Karim stays in both channels |
| rasiol (ADMIN) | in `/fr/admin/users`, delete Syu (creator and only moderator of *Carte d'identité*); then open `/fr/channels/<identite>/kick` and kick Lina | she disappears (5.3: an admin moderates a channel with no moderator, §C-19) |
| rasiol | open `/fr/channels/<identite>/edit`, change the title and save; then open `/delete` (do not confirm) | the save lands on `/fr/channels` with the new title (the channel page would 404 for a non-member); the delete page opens: no moderator and no creator are left, so only an admin may |
| any | `select actor."displayName", a.action, target."displayName", a."channelId" from "AuditLog" a left join "User" actor on actor.id = a."actorUserId" left join "User" target on target.id = a."targetId" order by a."createdAt" desc limit 5;` | newest first: `channel:update` (Rasiol, empty target: it is the channel), `channel:kick` (Rasiol, Lina), `user:delete` (Rasiol, empty target: Syu is gone), `answer:delete` (Amir); no row for the forged kick (5.2) |
| any | the pages above at 375, 768 and 1440 px | no sideways scroll; the console stays empty except for the forged submit (graded) |

Afterwards, `npm run db:reset` restores the seed.

### B13. Channel roles (phase 6)

Start from a fresh seed (`npm run db:reset`). *Assurance auto* (id 1, public) is moderated by its creator Amir; Adrien, Lina and Karim are members. Rasiol is the ADMIN and not a member of *Assurance auto* (in the seed he created *CAF* and is a member of *Titre de séjour*; B13 only uses *Assurance auto*). Every login uses `motdepasse123`. Use two browsers (or a private window) so Adrien stays signed in while Rasiol promotes him.

| As | Action | Expected |
|---|---|---|
| adrien | sign in, open `/fr/channels`, then ⋯ on *Assurance auto* | *Quitter* only |
| rasiol (ADMIN) | `/fr/channels/join`, join *Assurance auto*; then `/fr/channels`, ⋯ | *Supprimer*, *Modifier*, *Retirer un membre* and *Quitter* (an admin passes every `can()`) |
| rasiol | ⋯ → *Retirer un membre* | each row shows *membre* or *modérateur*; every row has *Nommer modérateur* or *Repasser membre*; Amir's has *Repasser membre* |
| rasiol | *Nommer modérateur* on Adrien | his row now says *modérateur* and offers *Repasser membre*; his *Retirer* disappears |
| adrien (still signed in from row 1) | reload `/fr/channels`, ⋯ | *Modifier*, *Retirer un membre* and *Quitter*, no *Supprimer* (he is not the creator; 6.2). No re-login was needed (6.1) |
| adrien | *Retirer un membre*, then *Retirer* on Lina | she disappears (6.3); no promote/demote buttons on his page (§C-18) |
| amir | open `/fr/channels/1/kick` | *Retirer* on members, no promote/demote buttons: a moderator does not manage roles (§C-18) |
| rasiol | *Repasser membre* on Adrien, then on Amir | both work, even though the channel is left with no moderator (§C-20) |
| amir | reload `/fr/channels`, ⋯ | *Quitter* only: a demoted creator can no longer delete (§C-20) |
| amir | open `/fr/channels/1/delete` | 404: the page asks the same `can()` |
| any | `select actor."displayName", a.action, target."displayName", a.metadata from "AuditLog" a left join "User" actor on actor.id = a."actorUserId" left join "User" target on target.id = a."targetId" order by a."createdAt" desc limit 4;` | newest first: `channel:setRole` (Rasiol, Amir, `{"role": "MEMBER"}`), `channel:setRole` (Rasiol, Adrien, `{"role": "MEMBER"}`), `channel:kick` (Adrien, Lina), `channel:setRole` (Rasiol, Adrien, `{"role": "MODERATOR"}`) |
| any | the kick page and the menu at 375, 768 and 1440 px | no sideways scroll (the name truncates beside the two buttons); the console stays empty (graded) |

Afterwards, `npm run db:reset` restores the seed.

### B14. Profile, avatar, online status (phase 12)

Two browsers (or a normal and a private window). amir and lina, seeded (`motdepasse123`). After pulling the `add_profile` migration: `npm run db:migrate`, then `docker restart mespapiers_web` (the running container keeps a Prisma client that does not know `lastSeenAt`, and every signed-in page is a 500 until it restarts).

| # | Do | Expect |
|---|---|---|
| 0 | As amir, `/fr/friends`: add `lina@gmail.com`. As lina: accept | they are friends |
| 1 | As amir: account menu → *Mon profil* | `/fr/users/<id>`: initials, *Amir*, *Membre depuis le …*, his email, the edit card; no dot |
| 2 | Save `"  Amir K  "`, then `"R"` | *Nom enregistré.* and the nav says *Amir K* without a reload; then the error, the name unchanged |
| 3 | Upload a portrait phone photo over 2 MB | it shows at once, upright and round; `/api/users/<id>/avatar` is a 256 × 256 `image/png` with `nosniff` and `private, no-store` |
| 4 | Upload a `.txt` renamed `.png` | *Choisissez une image PNG, JPEG ou WebP.*; the old picture stays |
| 5 | As lina, `/fr/friends` | amir's name is a link, *En ligne* |
| 6 | As lina, open amir's profile | picture, name, *En ligne*; no email, no edit card |
| 7 | amir logs out; lina reloads `/fr/friends` | *Hors ligne* |
| 8 | As rasiol, open amir's profile URL | picture and name; no dot, no email; an *Ajouter en ami* button |
| 9 | As rasiol, click *Ajouter en ami* | *Demande d'ami en attente* without a reload; amir's `/fr/friends` lists rasiol's request (leave it: row 10's block deletes it) |
| 10 | As amir (signed in again), `/fr/friends`: *Accepter* rasiol's request, then *Bloquer* him on the *Amis* tab (`/friends` offers *Bloquer* only to friends); as rasiol, reload amir's profile; as amir, open rasiol's | 404 both ways |
| 11 | `/fr/users/nope`, `/fr/users/%00`; the avatar URL signed out | 404, 400 (nginx refuses the NUL; the app alone answers 404); 401 |
| 12 | Rows 1–9 in `/en` and `/es` | translated, dates in the locale |
| 13 | 375 / 768 / 1440, keyboard only | no sideways scroll; Tab reaches the name field, *Enregistrer*, the file input and *Envoyer la photo* (and *Ajouter en ami* on a stranger's profile); the console stays clean |

Afterwards: `npm run db:reset` (reseeds), or rename amir back and delete the friendship and the block on `/fr/friends`.

### B15. Google sign-in (phase 8)

On **https://localhost**, not mespapiers.local: Google refuses `.local` redirect hosts (phase 8 plan, decision 1). Setup: `.env` has the Google client and `APP_URL=https://localhost`, then `docker compose up -d web`. Rows 4 and 6 need DevTools → Network with *Preserve log*.

| # | Do | Expect |
|---|---|---|
| 1 | `/fr/login`, `/fr/signup`, keyboard only | *Continuer avec Google* under each form, full width, reached by Tab after the submit button |
| 2 | Click it, pick `<you>` on Google | back on `/fr`, signed in, the nav shows your Google name. `select "passwordHash", "displayName" from "User" where email = '<you>'` → `NULL`, your name; one `OAuthAccount` row, `provider = 'google'` |
| 3 | Log out, *Continuer avec Google* again | the same user; still one `User` and one `OAuthAccount` row |
| 4 | *Mes données*: the field asks for your email. Type another address, then your own | *Ce n'est pas l'adresse e-mail de ce compte.*; then the account is deleted and you are on `/fr/login` |
| 5 | `/fr/signup` with `<you>` and a password; sign in with it in a private window too; in the first window log out, then *Continuer avec Google* | signed in to that account: one `User` row, one `OAuthAccount` row (linked), and `passwordHash` now `NULL`: the link drops the password (signup never checked the address) and ends every other session, so the private window is signed out on its next page and the password gives *Adresse e-mail ou mot de passe incorrect.* |
| 6 | After a sign-in, copy the `/api/auth/google/callback?...` URL from Network; log out; open it | `/fr/login` with *La connexion avec Google n'a pas abouti. Réessayez.* (the cookie is gone; Google also refuses a used code) |
| 7 | On Google's screen, cancel | `/fr/login` with the same message |
| 8 | Start on `https://mespapiers.local/fr/login` | Google, then back on `https://localhost/fr/login` with the message: the state cookie stayed on mespapiers.local. Expected |
| 9 | `/en/login`, `/es/login` | *Continue with Google*, *Continuar con Google* |
| 10 | 375 / 768 / 1440 on `/fr/login?error=oauth` | no sideways scroll; the console stays clean |
| 11 | Empty `GOOGLE_CLIENT_ID` in `.env`, `docker compose up -d web`, click the button | `/fr/login` with the message, Google is never shown. Put the key back |

Afterwards: delete `<you>` on *Mes données*, set `APP_URL=https://mespapiers.local` back if you test anything else, and `docker compose up -d web`.

### Cleanup

```sql
delete from "User" where email in ('moi@mespapiers.test', 'autre@mespapiers.test');   -- cascades to their sessions and documents
```
