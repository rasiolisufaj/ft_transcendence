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
npx vitest run src/lib/auth src/lib/audit.test.ts "src/app/[locale]/(auth)" "src/app/[locale]/(app)/admin" --reporter=verbose    # auth only
```

Expected: `npm test` reports **160 passed**. The auth part is 8 files and 79 tests; the rest is the documents code. The verbose run prints each test name with a ✓.

| File | What it proves |
|---|---|
| [password.test.ts](../src/lib/auth/password.test.ts) | argon2 never stores plaintext, salts every hash differently, rejects a wrong password, and returns `false` on a corrupt hash instead of crashing |
| [session.test.ts](../src/lib/auth/session.test.ts) | tokens are random and ≥128 bits; only the SHA-256 is stored; expired sessions are rejected and deleted; the expiry never slides; logout kills one session or all of them; channel memberships load. Uses the real DB. |
| [schemas.test.ts](../src/lib/auth/schemas.test.ts) | the signup and login rules; every error key exists in fr, en and es |
| [login/actions.test.ts](<../src/app/[locale]/(auth)/login/actions.test.ts>) | the action returns the schema's errors; 6 failures lock an email for 15 minutes |
| [policy.test.ts](../src/lib/auth/policy.test.ts) | `can()` denies unknown actions, even to an admin; an admin can do everything except touch another user's documents (the vault is owner-only, even for an admin); a moderator acts only in their own channel, and moderation is never granted by ownership; owners act only on their own rows; posting needs a membership; reputation grants nothing; `user:manage` and `channel:manageRoles` are admin-only, even on your own account. Plus the C4 truth table: one row per `Action` (23) with the resource its caller passes and the answer for admin, moderator, member, owner and stranger; a new `Action` without a row fails the typecheck |
| [admin/users/actions.test.ts](<../src/app/[locale]/(app)/admin/users/actions.test.ts>) | a non-admin cannot change a role or delete a user; an admin cannot demote or delete themselves; a role change ends that user's sessions; every change writes one `AuditLog` row; a role other than USER/ADMIN is refused; a double click or a stale page (user already gone, role already set) changes nothing and does not throw. Uses the real DB. |
| [audit.test.ts](../src/lib/audit.test.ts) | `writeAudit()` records the actor, action, target and channel; a failed write is logged and never throws. Uses the real DB. |

To run one test by name: `npx vitest run -t "never extends"`.

### A2. Prove a test really guards something

A test only counts if it fails when the code is wrong. Break the code on purpose, watch the test fail, then undo:

1. In [login/actions.ts](<../src/app/[locale]/(auth)/login/actions.ts>), change `return entry.count >= MAX_ATTEMPTS;` to `>`.
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
| As rasiol, open the nav (☰ below 1024 px) | An *Administration* link, which opens the user table |
| Search `EMM` | Only Emma's row (case-insensitive, on name and email) |
| Your own row | *Vous*, no buttons |
| *Rendre admin* on Amir, then *Retirer admin* | The badge changes each time. In psql, Amir has **no** `Session` row left: a role change signs him out everywhere, so his browser is back on the login page at the next click |
| *Supprimer* on a throwaway account, then **double-click** *Confirmer* | The row disappears; the account and its sessions and documents are gone; one `user:delete` row, and the console stays empty (the second click finds nothing to delete) |
| `select "actorUserId", action, "targetId", metadata from "AuditLog" order by "createdAt" desc limit 3;` | One row per change, newest first: `user:delete`, then two `user:setGlobalRole` with `{"role": "USER"}` and `{"role": "ADMIN"}`, all with rasiol's id as the actor |
| Resize to 375, 768 and 1440 px | No sideways scroll; below 640 px the table keeps the user and the actions, the role badge moves under the email |

### Cleanup

```sql
delete from "User" where email in ('moi@mespapiers.test', 'autre@mespapiers.test');   -- cascades to their sessions and documents
```
