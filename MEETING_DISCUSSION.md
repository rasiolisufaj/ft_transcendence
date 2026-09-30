# Meeting discussion

## Contents

- [Meeting discussion](#meeting-discussion)
  - [Contents](#contents)
  - [Database side](#database-side)
    - [Schema](#schema)
    - [Files](#files)
    - [Seed](#seed)
    - [Migrations](#migrations)
  - [@Sʞu: UI components and frontend](#sʞu-ui-components-and-frontend)
    - [UI components](#ui-components)
    - [Page structure](#page-structure)
  - [@Adrien11: Infra and AI](#adrien11-infra-and-ai)
    - [Infra](#infra)
    - [AI](#ai)
  - [Update from Amir: schema and seed](#update-from-amir-schema-and-seed)
  - [Update from Adrien: NGINX HTTPS setup](#update-from-adrien-nginx-https-setup)
    - [Setup](#setup)
    - [Optional: trusted certificate](#optional-trusted-certificate)
  - [Amir to Rasiol: auth handover](#amir-to-rasiol-auth-handover)
  - [Git workflow advice](#git-workflow-advice)
  - [Meeting of 21 September](#meeting-of-21-september)

---

## Database side

### Schema

We're going to move to a cleaner model. The idea is to have a `Document` table with the fields common to all documents, and then one table for each type of document. We'll start with something simple, like two document types:

- `DocumentIdentityId`
- `DocumentInsuranceAuto`

Community and social tables:

| Table               | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `Channel`           | Thematic channels (residence permit, car insurance, CAF, etc.)                   |
| `ChannelMembership` | Who is a member of which channel, with a role (`MEMBER` / `MODERATOR`)           |
| `Thread`            | A question posted in a channel                                                   |
| `Answer`            | A reply to a thread                                                              |
| `Vote`              | A vote on an answer (only once per user; this is what contributes to reputation) |
| `Friendship`        | Friend request (`PENDING` / `ACCEPTED` / `BLOCKED`)                              |
| `Conversation`      | A DM conversation between two users                                              |
| `Message`           | A message within a conversation                                                  |
| `Notification`      | Notifications (deadlines, replies, messages, friend requests)                    |

For the fields, feel free to decide what makes sense. We'll see later what we want to add or remove. We'll also see if we need to add more tables. @Rasiol will need to add some because they'll be required for OAuth.

### Files

Right now, we're storing the files directly as bytes in PostgreSQL, and it works. You can keep it that way or switch to something like MinIO if you prefer. It's up to you. We could gain some performance by doing so, but that can wait.

### Seed

Once the schema is solid and our migrations are working properly, you can create a small seed (test data) to populate the site. For example:

- A few users
- A few documents
- One or two channels with some threads for the community

### Migrations

There are currently two migrations on `main`. If you want to see how the migrations work, you can squash them into a single migration because the first one is unnecessary.

But in any case, you'll be adding new migrations to create the new tables and relationships.

---

## @Sʞu: UI components and frontend

So, to keep things moving with the React components, are you up for handling the first part: creating the component library + initial frontend?

### UI components

You started with the Button, and we'll need the basics, such as:

- Card for documents
- Badge
- Input
- Forms
- Components for messages
- And honestly, anything else you think could fit into the site: footer, navbar, etc.

These should go in `src/components/ui/`. The idea is to have reusable components that we can use everywhere.

### Page structure

We need the routing for the three main pillars of the site.

**Documents**

- Dashboard with the list of documents
- Upload page
- Document details page
- Anything else that makes sense for the site

**AI Assistant**

- A simple page for now, and we'll see what to add next

**Community**

- List of channels
- Channel view with its threads
- Thread page with the replies

(Amir is also making a seed, so we'll have some data to work with.)

For now, these are just skeleton pages. They don't need to be functional yet, because we'll need the data from the DB later thanks to Amir's work, and the same goes for authentication, so no worries.

For now, just focus on the structure, routing, and layout components. Then we can hook everything up afterwards.

You in?

---

## @Adrien11: Infra and AI

On my side: the infrastructure that runs everything, and the beginning of the AI part.

### Infra

- NGINX as a reverse proxy in front of Next.js
- TLS using mkcert to get a proper local certificate for `mespapiers.local` + `localhost`, so there are no Chrome warnings
  - I believe this is part of the subject
- Complete Docker Compose setup
  - Add NGINX, Redis, and eventually a worker service (deadline scanning — not just deadlines, but more generally the AI scanning part) when we get there
- A clean `.env.example`
- All the CI GitHub Actions keys needed for PRs

### AI

- Integrate the Anthropic SDK for document extraction: the user uploads a photo/PDF, the AI identifies the type, authority, dates, etc., and fills the corresponding tables
  - So @amir, we'll coordinate on this; you can tell me which fields you create
- Streaming for the assistant: the user asks a question about their document, and the response arrives token by token
- Collect some real documents to test the extraction

That's the idea... if everyone's on board!

---

## Update from Amir: schema and seed

I finished the schema, it's pushed on the `shemaprisma` branch. If you want to see what it looks like:

```bash
npm install
npx prisma migrate dev
npx prisma studio   # opens an interface in the browser
```

I added `prisma/seed.ts`. It creates 4 users, some documents and a channel with a thread.

To run it:

```bash
npm run db:seed
```

To see the data:

```bash
npx prisma studio
```

---

## Update from Adrien: NGINX HTTPS setup

Quick heads up on the NGINX infra: it is now our HTTPS reverse proxy. Everything goes through <https://mespapiers.local> now instead of <http://localhost:3000>.

### Setup

1. Open your hosts file as admin:

   ```bash
   sudo nano /etc/hosts
   ```

2. Add this line at the end:

   ```text
   127.0.0.1 mespapiers.local
   ```

3. Flush DNS:
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`
   - Linux: nothing to do (but you guys are on Inception, you know that already)

4. Pull `main`, run `docker compose up --build`, and go to <https://mespapiers.local>.

Chrome will show a "not private" warning (self-signed cert). Just click **Advanced → Proceed**. That's normal, HTTPS still works.

### Optional: trusted certificate

If you want the green padlock, install mkcert and run:

```bash
mkcert -install
mkcert -cert-file infra/nginx/certs/mespapiers.local+1.pem \
       -key-file infra/nginx/certs/mespapiers.local+1-key.pem \
       mespapiers.local localhost
```

But I think the cert part is not required by the subject.

---

## Amir to Rasiol: auth handover

Ok, I'm pushing what I did now. I did the front for the login and sign up pages, and I stopped at the back of the login page.

What is left for you:

- [ ] Login backend (check email and password)
- [ ] Password hashing
- [ ] Sessions/tokens
- [ ] Protected routes
- [ ] OAuth 2.0

Sorry, I didn't know it was your part.

---

## Git workflow advice

**Branches.** As a best practice, when you open a PR for a branch and it gets merged, you should delete the branch afterwards. However, while the PR is still open, you should keep the branch so you can make changes if there are code reviews.

**Commits.** It depends on your internal workflow. Both approaches are reasonable. At my company, we rebase everything into a single commit to make it easier for reviewers. Other companies keep the commits separate.

But if you have a commit where you only added a comment or fixed some syntax, we generally prefer to squash it into the previous commit rather than cluttering the PR.

## Meeting of 21 September

**Adrien:** https://app.notion.com/p/TO-DO-Modules-3e0068eaf65f801b8b7dc9737e19fee2?source=copy_link

Adrien said: I think priority:
- Front and Back community: Community dashboard, with channels, threads, issues, and so on -> when we build it, we need to think about permissions afterward; moderators can allow or not messages, see all threads and so on, On that dashboard we can see our friends and add some others and have an instant chat.
- Scanning images, contracts, pdf and so on with AI to build our models.
- Add the LLM interface system, sending a document, and have a conversation with AI about it
- Permission system
- AND OVERALL CREATE EACH AND EVERY FRONT PAGE NEEDED