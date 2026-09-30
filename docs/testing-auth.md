# Testing the auth work (roadmap phases 0–2.4)

How to check the auth code yourself: the session core, signup / login / logout, and the route guard. It covers roadmap tasks 0.4, 1.1–1.3 and 2.1–2.4 (C1, C2, C3, and part of C5 and C11 in `PROJECT_PLAN.md` §7).

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
npx vitest run src/lib/auth "src/app/[locale]/(auth)" --reporter=verbose    # auth only
```

Expected: `npm test` reports **57 passed**. The auth part is 4 files and 25 tests; the rest is the documents code. The verbose run prints each test name with a ✓.

| File | What it proves |
|---|---|
| [password.test.ts](../src/lib/auth/password.test.ts) | argon2 never stores plaintext, salts every hash differently, rejects a wrong password, and returns `false` on a corrupt hash instead of crashing |
| [session.test.ts](../src/lib/auth/session.test.ts) | tokens are random and ≥128 bits; only the SHA-256 is stored; expired sessions are rejected and deleted; the expiry never slides; logout kills one session or all of them; channel memberships load. Uses the real DB. |
| [schemas.test.ts](../src/lib/auth/schemas.test.ts) | the signup and login rules; every error key exists in fr, en and es |
| [login/actions.test.ts](<../src/app/[locale]/(auth)/login/actions.test.ts>) | the action returns the schema's errors; 6 failures lock an email for 15 minutes |

To run one test by name: `npx vitest run -t "never extends"`.

### A2. Prove a test really guards something

A test only counts if it fails when the code is wrong. Break the code on purpose, watch the test fail, then undo:

1. In [login/actions.ts](<../src/app/[locale]/(auth)/login/actions.ts>), change `return entry.count >= MAX_ATTEMPTS;` to `>`.
   - Run `npx vitest run -t "locks an email"`. Expected: **FAIL**.
2. In [session.ts](../src/lib/auth/session.ts), comment out the `if (row.expiresAt.getTime() <= Date.now()) { … }` block.
   - Run `npx vitest run -t "expired"`. Expected: **FAIL**.
3. Undo both edits. Check that `git diff src/` shows none of your edits, then run `npm test` again (57 passed).

### A3. Build gates (graded: zero errors)

```bash
npm run build && npm run typecheck && npm run lint
```

Expected:
- **Build:** a route table where every route is `ƒ`, meaning dynamic. That's normal: the nav reads the session cookie on every page.
- **Typecheck:** prints nothing.
- **Lint:** `0 errors`. The 2 known warnings are in `prisma/seed.ts`.

If the build says `Cannot find module '…/src/app/[locale]/page.js'`, `.next/dev/types` is stale from before the routes moved into `(app)`. Run `rm -rf .next/dev/types` and build again.

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

- Use a **private window** at `https://localhost`, or `https://mespapiers.local` if you have the hosts entry. Accept the self-signed certificate.
- Keep DevTools open, on the **Console** and **Network** tabs.
- The seeded users have no password and cannot log in. Every step below uses a fresh account, `moi@mespapiers.test`.

### B1. The guard

| Action | Expected |
|---|---|
| Go to `/fr` | You land on **`/fr/login`**. The nav shows *Se connecter* and *Créer un compte*, and no dashboard links. |
| Go to `/es/documents/new` | You land on **`/es/login`**, so the language is kept |
| `curl -k -i https://localhost/api/documents/1` | **`401`**. Before task 2.4 this returned the seeded user's file to anyone. |

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
  curl -k -i -b "mp_session=PASTE_COOKIE_VALUE" https://localhost/api/documents/YOUR_DOC_ID   # 200
  curl -k -i -b "mp_session=PASTE_COOKIE_VALUE" https://localhost/api/documents/1             # 404, someone else's
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
   - change `-H 'origin: https://localhost'` to `-H 'origin: https://evil.example'`
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

### Cleanup

```sql
delete from "User" where email = 'moi@mespapiers.test';   -- cascades to its sessions and documents
```
