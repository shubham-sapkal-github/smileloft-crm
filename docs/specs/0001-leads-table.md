# 0001 — Leads table for a dental practice

- **Status:** approved
- **Date:** 2026-08-19
- **Author:** shubham (with Claude)

## The requirement, in my own words

Build one authenticated page listing dental-practice leads in a table, backed by
Mongoose/MongoDB. Each lead holds name, email, phone, location, treatment
interest, status, stage and owner.

**Stage** is where the lead sits in the pipeline — New, Contacted, Consult
Booked, Treatment Planned, Won, Lost. **Status** is a separate filing flag,
Active or Archived, unrelated to the pipeline: a finished implant patient is
stage `Won` and status `Archived`; a cold lead is stage `Lost` and may also be
archived. Archiving takes a record off reception's working list. **Nothing is
ever deleted.** Default status is Active.

Each row offers three actions: move the lead to a different stage, assign it to
an owner, and attach a note. **Assigning an owner is admin-only.** The owner
field exists to make someone accountable for a patient; if an agent could hand a
lead to a colleague they could quietly drop a difficult patient off their own
list and nobody would notice. An admin reassigning is a management decision.
Agents can still change stage and add notes on their own leads.

Two roles decide what a signed-in user sees: an **admin** sees every lead in the
practice; an **agent** sees only the leads they own. That restriction is
enforced on the server by scoping the query to the caller's own leads — not by
hiding rows or buttons in the UI — and the same scope guards each of the three
row actions, so an agent cannot act on a lead that isn't theirs even by posting
directly to the endpoint.

Auth is **not built here**. This spec defines a single function,
`getCurrentUser()`, returning `{ id, name, role }` from a hardcoded list of two
users (one admin, one agent). Every permission check calls that function and
nothing else, so when real auth arrives `getCurrentUser()` is the only thing
that changes. A clearly-marked dev-only switcher lets us show both roles side by
side; it must not work when `NODE_ENV` is production.

## In scope

- `Lead` Mongoose model with the eight fields, a notes array, and timestamps.
- Mongoose connection helper, cached on `globalThis` per `docs/STACK.md`.
- `getCurrentUser()` over a hardcoded two-user list, plus the dev-only switcher.
- A data access layer that is the only path to lead data, applying the ownership
  scope on both reads and writes.
- One page at `/leads` rendering the table.
- Three row actions: change stage, assign owner, add note.
- Show/hide archived leads (default: Active only), since archiving is
  meaningless without it.
- A seed script, because there is no way to create a lead in this spec.

## Out of scope, deliberately

| Thing | Why not | What happens instead |
|---|---|---|
| Real authentication (login, sessions, password handling) | It is a whole system with its own security surface, and specifying it properly alongside a table spec means doing neither well. Getting auth wrong is the expensive kind of wrong. | `getCurrentUser()` is the single seam. Real auth replaces its body and nothing else in the codebase moves. Prerequisite for any deploy. |
| Creating and editing leads through the UI | Not asked for. The requirement is a table of leads with three row actions; a create/edit form is a second feature with its own validation rules. | Seed script populates the table. Add a create form when there's a real intake flow to model. |
| Deleting leads | Explicitly ruled out — "nothing gets deleted". Archive is the delete. | Status `Archived`. |
| An archive/unarchive row action | Not among the three actions named. Status still exists as a column and a filter so archived records behave correctly today. | Seed data covers both statuses; add the action when reception needs to archive from this screen. |
| Pagination, sorting, search, column filters | Speculative at unknown data volume. A practice with 200 leads does not need any of it, and the right design depends on how big the list actually gets. | Render the full scoped list. Revisit past ~500 rows or when the page feels slow. |
| Editing or deleting notes, and an audit log of stage/owner changes | Notes are append-only, which is the safe default for a clinical-adjacent record. A real audit trail is a compliance feature that needs its own retention decisions. | Notes carry author and timestamp. Mutations do not record history yet. |
| Email/SMS notification on stage change or assignment | Nobody asked, and it needs a provider, templates and a suppression story. | Nothing is sent. |
| Bulk actions, CSV export, real-time updates | Speculative. Each is a feature on its own. | Single-row actions, refresh on mutation. |
| A polished mobile layout | This is a reception desktop screen. | Table scrolls horizontally on narrow screens; not designed for phones. |
| PII protections beyond the ownership scope (encryption at rest, field-level redaction, GDPR export/erasure) | Real requirements for real patient data, but they are a compliance workstream, not a table feature — and MongoDB currently runs locally with auth disabled. | Recorded as a known gap. Must be settled before this touches real patient data. |

## Approach

New files only; nothing existing is modified except `src/app/layout.tsx` (to
mount the dev switcher) and `docs/STACK.md` (to fill in the `db seed` row).

| File | Responsibility |
|---|---|
| `src/lib/db.ts` | `connectToDatabase()`. Caches the mongoose connection promise on `globalThis` so hot reload reuses one connection. Reads `MONGODB_URI`, throws at startup if unset. |
| `src/models/lead-enums.ts` | `STAGES`, `STATUSES` and their types. **No `server-only`** — see below. |
| `src/models/Lead.ts` | Mongoose schema + model, guarded against re-registration on hot reload. `server-only`. |
| `src/lib/users.ts` | The hardcoded `USERS` list and the `User`/`Role` types. **No `server-only`**, for the same reason as the enums: the seed script (plain Node) and the switcher dropdown (a Client Component) both need it. |
| `src/lib/auth.ts` | `getCurrentUser()` and `setDevUser()`. `server-only`. |
| `src/lib/leads.ts` | Data access layer: `listLeads()`, `setStage()`, `assignOwner()`, `addNote()`. Marked `import 'server-only'`. |
| `src/app/leads/page.tsx` | Server Component. Awaits `listLeads()`, renders the table, the acting user and the lead count, and the archived toggle. |
| `src/app/leads/lead-row.tsx` | Client Component for the three row controls. |
| `src/app/leads/dev-user-switcher.tsx` | Dev-only role switcher. A **Server** Component with a plain form — no client JS needed, and `setDevUser` is passed straight to `action`. Lives in the leads header rather than the root layout, so the acting user sits next to the lead count that proves the scope is real, and it stays off unrelated pages. |
| `scripts/seed.ts` | Seeds 12 leads across **all six stages**, both statuses and both owners, plus one unowned. Idempotent: matched on `name` and updated in place, so re-running during a demo resets rather than duplicates. Run with `npm run seed`. |
| `src/lib/leads.test.ts` | The runnable check (see Test cases). |
| `vitest.config.mts` | Test plumbing: loads `.env.local` (Vitest does not, Next does) and aliases `server-only` to its own `empty.js`, which is what the `react-server` condition resolves to. Without the alias every test importing a server-only module fails on import. |

### The permission model

One helper expresses the whole rule, defined by **what the user owns** rather
than by a list of things to block:

```
scopeFor(user) -> user.role === 'admin' ? {} : { ownerId: user.id }
```

Every query and every mutation merges that scope into its filter. A mutation is
`findOneAndUpdate({ _id: id, ...scopeFor(user) }, …)` — so an agent acting on
someone else's lead matches **zero documents** and the update never happens.
Authorisation is a property of the query, not a branch that can be forgotten.

Ownership scope answers *which leads* a caller may touch. One action carries a
second, separate rule: **`assignOwner()` requires `role === 'admin'`**, checked
before anything else and independent of who owns the lead. An agent calling it
is refused even for a lead they own. The two rules are deliberately distinct —
scope is about ownership, this one is about authority — and both live in
`src/lib/leads.ts`.

**Order matters inside every mutation.** The caller is identified, then
authorised, and only then is the payload looked at:

1. `getCurrentUser()`
2. authority check (`assignOwner` only: `role === 'admin'`)
3. locate the lead **within the caller's scope** — refuse if it isn't there
4. validate the payload
5. write, with the scope in the write filter as well

Steps 2–3 run before step 4 so a caller who may not touch a lead is refused
identically whether the payload they sent is valid, invalid or empty. Putting
validation first would let an agent tell a real lead id from a fake one by the
error message that came back.

The scope is in the write filter *as well as* the pre-check deliberately: the
read can go stale, and an edit that later drops the pre-check must not silently
open a hole.

Server Functions are reachable by direct POST, not only through our UI (Next.js
data-security guide), so every one of the three actions calls `getCurrentUser()`
and re-derives the scope itself. Nothing trusts an id, a role or an owner sent
from the client.

A lead that does not exist and a lead the caller may not touch return the **same
generic failure** — "Lead not found" — so the table cannot be used to probe
which lead ids exist.

### `getCurrentUser()` and the dev switcher

`USERS` is two hardcoded entries: one `admin`, one `agent`. `getCurrentUser()`
is wrapped in React's `cache()` so every call in a request returns the same
object, and returns the admin by default.

The switcher **cannot** be a bare `?as=` query parameter: Server Functions do
not receive `searchParams`, so the page and the row actions would disagree about
who is acting. The active user is therefore held in a `dev-user` cookie, set by
a `setDevUser()` Server Action behind a `<select>` in the header. Both the page
render and the actions read the same cookie.

Both halves are hard-guarded:

- `getCurrentUser()` ignores the cookie entirely when `process.env.NODE_ENV === 'production'`.
- `setDevUser()` returns without setting anything in production.
- The switcher component renders `null` in production.

The guard is on the server in `getCurrentUser()`. The other two are convenience,
not the control.

### Data model

Only `name` is required. Location and treatment interest are optional, and so
are email and phone **individually**: a lead often arrives with a phone number
and nothing else, and refusing to store that loses the lead.

But a lead must carry **at least one of email or phone**. Someone with a name
and no way to be contacted can never be followed up, so they are not a lead.
Enforced by a `pre("validate")` hook on the schema, which covers every write
path in this spec — the three row actions touch stage, owner and notes, never
the contact fields.

`Lead`: `name`, `email`, `phone`, `location`, `treatmentInterest` (all strings —
`location` is the patient's home town, e.g. "Manchester", plain data with no
bearing on permissions);
`stage` (enum of the six, default `New`); `status` (enum `Active` | `Archived`,
default `Active`); `ownerId` (string, indexed, matches a `USERS` id);
`notes: [{ body, authorId, authorName, createdAt }]`; `timestamps: true`.

`ownerId` is a plain string today because users are hardcoded. When real auth
lands it becomes an `ObjectId` ref — carried as a `TODO:` in the model.

Stage and status enums are declared **once**, in `src/models/lead-enums.ts`, and
imported everywhere else, so the dropdown options and the server-side validation
cannot drift apart.

They live in their own module rather than in `src/models/Lead.ts` because the
model imports `server-only`, and the row controls are a Client Component that
needs the same lists for its dropdowns. Importing the model from the client
fails the build — verified by deliberately doing it — so the constants, which
are plain strings and safe on either side, are the shared piece and the model is
not. `src/models/Lead.ts` does not re-export them: one import path, so nobody
reaches the enums through the server-only module by habit.

### Flow

1. `/leads` (Server Component) → `getCurrentUser()` → `listLeads()` → scoped
   query, archived excluded unless `?archived=1` (awaited — `searchParams` is a
   Promise in this Next version) → table.
2. Row control fires a Server Action → action calls `getCurrentUser()`,
   validates input against the enums, applies `scopeFor(user)` in the filter,
   writes → `revalidatePath('/leads')` → table re-renders.

## Edge cases

| Case | Expected behaviour |
|---|---|
| Agent posts an action for a lead they don't own | Filter matches nothing. No write. Generic "Lead not found". |
| Client posts a stage that isn't one of the six | Rejected before the write by checking against the enum. |
| Client posts an `ownerId` not in `USERS` | Rejected. Owner must be an existing user. |
| Agent calls `assignOwner()` on a lead they own | Refused — admin-only. No write. Generic error. The control is not rendered for agents either, but the server is what enforces it. |
| Admin reassigns a lead from one agent to another | Allowed. The lead leaves the old owner's list and appears in the new owner's. |
| Empty or whitespace-only note | Rejected, nothing written. |
| Lead written with a name but no email and no phone | Rejected by the model. |
| Malformed lead id (not an ObjectId) | Same generic "Lead not found" — no cast error leaks out. |
| Note longer than 2000 characters | Rejected. A cap has to exist somewhere; 2000 is roughly a screen of text. |
| Note submitted but the write fails | The action returns an error and the typed text stays in the box. A failed note must not silently vanish. |
| Two people change the stage of one lead at once | Last write wins. Acceptable at practice scale; no locking. |
| Lead has no owner | Visible to admins only, since no agent owns it. Seed includes one. |
| Archived leads | Hidden by default; shown via the toggle, visually muted, still fully actionable. |
| `MONGODB_URI` unset | `connectToDatabase()` throws a clear error naming the variable, rather than a driver-level failure. |
| Mongo container not running | Page shows a plain error state; the app does not hang. |
| Dev switcher in production | Header control absent, action inert, cookie ignored server-side. |

## Permissions

| Who | Reads | Change stage | Assign owner | Add note |
|---|---|---|---|---|
| Admin | Every lead | Any lead | Any lead | Any lead |
| Agent | Only leads where `ownerId === user.id` | Own leads | **Never** — admin only | Own leads |
| Signed out | n/a until real auth — `getCurrentUser()` always returns a user today | | | |

Two checks run **on the server**, inside `src/lib/leads.ts`: the ownership scope
merged into the database filter itself, and the admin-only role check on
`assignOwner()`. The UI does not decide anything: hiding a control is
presentation, never permission. Denials return the same generic message as a
missing record.

## Subtasks

| # | Task | Estimate |
|---|---|---|
| 1 | `src/lib/db.ts` — connection cached on `globalThis` | 30 min |
| 2 | `src/models/lead-enums.ts` + `src/models/Lead.ts` — schema, enums, indexes | 45 min |
| 3 | `src/lib/auth.ts` — `getCurrentUser()`, `USERS`, `setDevUser()`, production guard | 45 min |
| 4 | `src/lib/leads.ts` — `scopeFor()`, list + three mutations, validation | 1.5 h |
| 5 | `scripts/seed.ts` + fill in the `db seed` row in `docs/STACK.md` | 45 min |
| 6 | `/leads` page and table markup (Tailwind v4) | 1.5 h |
| 7 | Row controls wired to the actions, error states | 1.5 h |
| 8 | ~~Dev switcher in the header~~ — done early, with subtask 6 | — |
| 9 | `src/lib/leads.test.ts` | 45 min |
| 10 | Verification pass per `docs/VERIFICATION.md`, both roles in the browser | 45 min |

## Test cases

Vitest. Cases 1–2 are pure and need no database. Cases 3–6 run against the local
Mongo container and are the ones that actually prove the permission model.

| # | Given | When | Then |
|---|---|---|---|
| 1 | An admin user | `scopeFor(user)` | `{}` — unrestricted |
| 2 | An agent user | `scopeFor(user)` | `{ ownerId: <their id> }` |
| 3 | Leads owned by two different agents | Agent A calls `listLeads()` | Only A's leads; B's never appear |
| 4 | A lead owned by agent B | Agent A calls `setStage()` on it | No write; B's lead unchanged; generic error |
| 5 | A lead owned by agent B | Admin calls `setStage()` on it | Write succeeds |
| 6 | Any lead | `setStage()` with `"Deleted"` | Rejected; stored stage unchanged |
| 6a | A lead owned by agent A | Agent A calls `assignOwner()` | Refused — admin only; `ownerId` unchanged |
| 6b | A lead owned by agent A | Admin calls `assignOwner()` | Write succeeds; owner changes |
| 7 | Any lead | `addNote()` with `"   "` | Rejected; notes array unchanged |
| 8 | `NODE_ENV=production` and a `dev-user` cookie naming the agent | `getCurrentUser()` | Returns the default admin; cookie ignored |
| 9 | `NODE_ENV=production` | `setDevUser()` with a **valid** user id | No cookie written. The id must be valid or the id check, not the production guard, is what stops the write — and the test would pass with the guard deleted |
| 10 | A lead with a name and no contact details | `Lead.create()` | Rejected — "at least one of email or phone" |
| 11 | A lead with a name and only a phone | `Lead.create()` | Accepted |

Cases 4, 6a, 8 and 9 are the ones that matter. Each is verified by deleting the
rule it covers and confirming the test goes red — a test for a security guard
that has never been seen to fail is not evidence the guard works.

Cases 4 and 6a are the ones that matter. If it ever goes green while the write succeeds,
the permission model is broken regardless of what the UI shows.

## Open questions

All resolved. Answers 1–3 came from you; the rest were **decided by default** —
I took the simplest sensible option and recorded it here rather than blocking.
Any of them can be reopened cheaply.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Can an agent reassign a lead away from themselves? | **No — admin only.** | *(Your call.)* The owner field makes someone accountable for a patient. An agent handing a lead on could quietly drop a difficult patient off their own list unnoticed. Reassignment is a management decision. |
| 2 | Names for the two hardcoded users, and who owns the seed data? | **Priya Shah (admin), Tom Reid (agent).** Tom owns most of the seed leads. | Default by me. Concrete names read better than "Admin User" when the switcher is on screen. Loading the agent with most of the data makes the role difference obvious the first time you flip the switcher — if agent view and admin view look alike, the demo proves nothing. One lead is left unowned so the admin-only case is visible too. |
| 3 | Treatment interest — free text or fixed list? | **Free text.** | Default by me. A fixed list is better data, but only if it's the practice's *real* list; inventing one means either guessing wrong or quietly constraining what reception can type. Free text now, promote to an enum the moment someone hands over the actual treatment menu — the same way stage and status are already enums declared once in the model. |
| 4 | Location — patient's town, or practice branch? | **Patient's home town**, e.g. "Manchester". Plain data, no permission meaning. | *(Your call.)* If multi-branch access control ever comes up, it's a separate spec. |
| 5 | Should admins get an owner filter ("show me just Tom's leads")? | **No.** | Default by me. It's a filter feature, and I've already put pagination/sorting/search out of scope for the same reason — unknown data volume. At the size where an admin needs to filter by owner, they need sorting and search too, and that's one coherent piece of work rather than a one-off dropdown. |
| 6 | Can an agent see notes an admin wrote on their lead? | **Yes — all notes are visible to anyone who can see the lead.** | Default by me. The alternative is private/internal notes, which is a visibility model of its own (who can see what, how it's marked, what happens on reassignment). Nobody asked for it, and a note that's secretly invisible to the person working the lead is a worse failure than one that's too visible. If confidential notes are ever needed, that's a deliberate feature, not a default. |

## Changelog

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Plan written | Claude |
| 2026-08-19 | Agent reassignment restricted to admins; location confirmed as patient town; no create form; questions 2, 3, 5, 6 decided by default | Claude |
| 2026-08-19 | **Plan approved** | shubham |
| 2026-08-19 | Subtask 6 built, plus subtask 8 pulled forward (the switcher is needed to see both roles). Rung 4 closed in a real browser | Claude |
| 2026-08-19 | Subtask 5 built: idempotent seed across all six stages; `USERS` split into `src/lib/users.ts`; added `tsx` to run scripts | Claude |
| 2026-08-19 | Subtask 4 built: `scopeFor`, `listLeads`, three mutations, permission-before-payload ordering. Verified by deleting each rule | Claude |
| 2026-08-19 | Added the "at least one of email or phone" rule (subtask 2) | Claude |
| 2026-08-19 | Subtask 3 built: `getCurrentUser()`, `setDevUser()`, production guards, mutation-verified | Claude |
| 2026-08-19 | Subtasks 1–2 built. Added `vitest.config.mts` to the file list; split the enums out of the server-only model into `src/models/lead-enums.ts` | Claude |
