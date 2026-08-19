# 0005 — Application shell and visual pass

- **Status:** approved
- **Date:** 2026-08-19
- **Author:** shubham (with Claude)
- **Builds on:** specs 0001–0003. Does not change anything they do.

## The requirement, in my own words

A presentation and shell pass over the existing app, with **no change to what
anything does**.

The leads table stops pushing the page sideways by **combining columns rather
than shrinking text**, and any scroll that remains happens inside the table's own
container so the page itself never moves horizontally. The app is restyled to
read as an internal tool someone sits in all day — comfortable row height, clear
headers, quiet borders, stage pills that read as labels rather than decoration.
Restrained. Tailwind only: no UI library, no new dependency.

Around it goes a shell: a collapsible left sidebar whose collapsed state survives
a reload, with **Leads** and **Funnel** live, and Patients, Appointments,
Treatments, Invoices, Reports, Settings and Users & Roles present as visibly and
deliberately unbuilt placeholders — dimmed, not clickable, no dead links, no
404s. A top toolbar carries the practice name, the current user and sign out.

The dev user switcher is replaced by a `/signin` screen where you pick which demo
user you are. **This is not authentication.** No passwords, no session store, no
sign up. Signing out clears the `dev-user` cookie and returns to `/signin`.

`setDevUser`'s production guard is untouched, its tests pass unchanged, all 58
tests pass, `npm run prove:permissions` passes, and rung 4 re-covers the table,
the funnel, every row action, the create form, archive and unarchive, and both
roles.

## The sign-in screen is not protection

This needs saying plainly, in the spec and on the page, because a screen that
looks like a login invites everyone who sees it to believe something is being
protected. Nothing is.

- Anyone can reach `/signin` and choose the **admin**. There is no credential,
  so there is nothing to fail.
- The redirect from `/leads` to `/signin` is a **cosmetic routing rule**, not an
  access control. It exists so the demo has a front door.
- Every Server Action remains **directly callable** without ever visiting the
  sign-in screen, as `scripts/prove-permissions.ts` demonstrates on purpose.
- What actually protects data is unchanged and unmoved: `scopeFor(user)` merged
  into every read and write in `src/lib/leads.ts`, and the server-derived
  ownership in `createLead()`.

**Real authentication remains a prerequisite, exactly as spec 0001 states.**
`getCurrentUser()` is still the single seam, and it is still the only thing that
changes when real auth arrives. This spec deliberately makes the app *look*
further along than it is, which is precisely why the limitation is written here
in full.

### `getCurrentUser()` is not touched

The obvious implementation — have `getCurrentUser()` return null when there is
no cookie — would break two tests that must not break:

| Test | Why it would fail |
|---|---|
| `with no cookie, the current user is the admin` | Asserts the default user is returned. |
| `in production, the dev-user cookie is ignored entirely` | A **security** test: it asserts the production guard returns the default admin regardless of cookie. |

So `getCurrentUser()` is left exactly as it is. The routing gate is a **separate,
additive** helper that only asks whether a known demo user has been chosen, and
it is consulted **only** for routing and **only** when `isDevSwitcherEnabled()`
is true. In production the gate does not exist: no redirect, and `/signin`
renders a notice saying the demo switcher is disabled. Production behaviour is
byte-for-byte what it is today.

## In scope

- Table restructured from eight columns to six, grouped by meaning.
- Page never scrolls horizontally; the table's container does if needed.
- Visual pass: row height, headers, borders, stage pills.
- `src/app/leads/layout.tsx` shell: sidebar + toolbar.
- Sidebar with a cookie-remembered collapsed state; **Leads** and **Funnel**
  (in-page anchor) live; seven disabled placeholders.
- Toolbar: practice name, current user, sign out.
- `/signin`: pick a demo user, clearly labelled as a demo front door.
- `clearDevUser()` sign-out action, and a cookie-presence helper for routing.
- Removal of `dev-user-switcher.tsx`, whose job moves to `/signin`.
- `id="funnel"` on the funnel section so the nav anchor has a target.
- Root layout metadata title, currently still "Create Next App".

## Out of scope, deliberately

| Thing | Why not | What happens instead |
|---|---|---|
| Real authentication | The whole point of the section above. Passwords, sessions, hashing, reset flows and lockout are a system with its own security surface, and a demo front door is not a down payment on it. | `getCurrentUser()` remains the seam. Recorded as a prerequisite in specs 0001 and here. |
| Sign up | Explicitly not wanted, and meaningless without real auth — there is no account to create. | Two hardcoded demo users. |
| Building any placeholder section | Patients, Appointments, Treatments, Invoices, Reports, Settings, Users & Roles are each a product. Stubbing them as empty pages would be worse than showing them as unbuilt: an empty page implies it is coming, a dimmed item states it is not here. | Dimmed, unclickable, labelled "not built". |
| A `/funnel` route | Spec 0002 ruled it out — the funnel belongs above the table — and adding one would be a behaviour change in a spec that says it makes none. | An in-page anchor to `#funnel`, which keeps the sidebar from reading as one live item and eight dead ones. |
| An icon library | A dependency for decoration. The sidebar reads fine as text, and the one glyph needed (a collapse chevron) is inline SVG. | Text labels, one inline chevron. |
| A responsive/mobile redesign | This is a reception desktop screen, as spec 0001 already recorded. Making the shell genuinely good on a phone is its own piece of work. | The sidebar collapses on demand at any width; the layout does not fall apart, but it is not designed for phones. |
| A dark mode toggle | The app already follows the system preference through the existing Tailwind `dark:` classes. A toggle needs its own persisted state and a control in the toolbar. | System preference, as now. |
| Theming or branding beyond a practice name | No brand exists to apply. | One name in the toolbar. |
| Per-user sidebar state, user profile pages, breadcrumbs, command palette, keyboard shortcuts | None asked for; each is a feature with its own state and surface. | The sidebar state is per browser, via a cookie. |
| A full accessibility audit | Out of scope as a project, but the basics are not: labelled controls, real focus states, `aria-disabled` and non-focusable placeholders, and headers that are actual `<th>` elements. | Basics done, audit not claimed. |

## Approach

### The table: eight columns to six

Grouped so each column answers one question.

| Column | Contains |
|---|---|
| **Patient** | Name, with email and phone underneath in smaller grey text — who they are and how to reach them |
| **Enquiry** | Treatment interest, with location underneath — what they asked for and where they are coming from |
| **Stage** | Pill + the move control |
| **Status** | Active/Archived + the archive control |
| **Owner** | Owner name + the assign control (admins only) |
| **Notes** | Existing notes + the add-note control |

Text is not shrunk to fit; the four identity and contact fields become two
stacked columns. The table keeps `overflow-x: auto` on its container so any
residual overflow stays inside it, and the page body never scrolls sideways.

### Files

| File | Change |
|---|---|
| `src/app/leads/layout.tsx` | **New.** The shell — sidebar and toolbar — wrapping everything under `/leads`. `/signin` sits outside it deliberately, so the front door has no chrome. |
| `src/app/leads/sidebar.tsx` | **New.** Nav items, disabled placeholders, collapse toggle. |
| `src/app/leads/toolbar.tsx` | **New.** Practice name, current user, sign out. |
| `src/app/signin/page.tsx` | **New.** Pick a demo user. Renders the "not authentication" notice. |
| `src/lib/auth.ts` | **Additive only:** `clearDevUser()` and a cookie-presence helper. Nothing existing is modified. |
| `src/app/leads/dev-user-switcher.tsx` | **Deleted** — its job moves to `/signin`. |
| `src/app/leads/page.tsx` | Header controls, table headers, no switcher. |
| `src/app/leads/lead-row.tsx` | Cells regrouped into the six columns. |
| `src/app/leads/funnel.tsx` | `id="funnel"`. |
| `src/app/layout.tsx` | Metadata title only. |

### The sidebar's collapsed state

A cookie, not `localStorage`. `localStorage` needs client JS and produces a
visible flash — the server renders the sidebar expanded and script collapses it
after paint, on every single load. A cookie is read during the server render, so
the first paint is already correct. It is toggled by a plain form posting to a
Server Action, the same no-JS pattern the app already uses.

### Disabled placeholders

Rendered as `<span>`, never `<a href>`: no href means no dead link and no 404,
and nothing to tab into. Marked `aria-disabled="true"`, dimmed, with a small
"not built" label. The intent is that they read as *deliberately absent* rather
than broken.

## The one thing that will break, and why

`scripts/prove-permissions.ts` discovers the live action id by fetching
`/leads` **without a cookie** and grepping the served chunks. Once `/leads`
redirects a cookie-less request to `/signin`, that fetch returns the sign-in page,
the chunk is not found, and the script fails with "could not find the action id".

The fix is to send a `dev-user` cookie on that discovery fetch, as it already
does on the POSTs it makes. **This changes the proof's plumbing, not what it
proves** — the two POSTs, the agent's refusal, the admin control case and the
stored-record assertions are all untouched.

No test file needs changing. All 58 tests pass unchanged, including the seven in
`auth.test.ts`.

## Edge cases

| Case | Expected behaviour |
|---|---|
| `/leads` with no `dev-user` cookie, in development | Redirect to `/signin`. |
| Cookie present but naming an unknown user | Treated as not chosen: redirect to `/signin`. Prevents a stale or hand-edited cookie leaving someone silently acting as the default admin. |
| `/leads` in production | **No redirect.** Nothing about production changes. |
| `/signin` in production | Renders a notice that the demo switcher is disabled. No user list, no action. |
| Sign out in production | Inert, like `setDevUser`. |
| Sidebar cookie absent | Expanded. |
| Sidebar collapsed, then reload | Still collapsed, correct on first paint, no flash. |
| A disabled nav item clicked or tabbed to | Nothing happens; it is not a link and not focusable. |
| Very long lead name or email | Wraps inside the Patient column; the page still does not scroll sideways. |
| Narrow window | The table's own container scrolls; the page body does not. |
| Existing deep link to `/leads?archived=1` | Works unchanged, once a demo user is chosen. |

## Permissions

**Unchanged, and deliberately untouched.** This spec adds no query, no scope
rule and no write path. Permission decisions stay in `src/lib/leads.ts` behind
`scopeFor(user)` and `createLead()`'s server-derived ownership.

The toolbar displays the current user. Displaying identity is not asserting it:
the lead count in the header remains the visible evidence that scoping is real,
and `npm run prove:permissions` remains the proof that the server, not the UI,
is what refuses.

## Subtasks

| # | Task | Estimate |
|---|---|---|
| 1 | `clearDevUser()` + cookie-presence helper in `auth.ts` (additive) | 30 min |
| 2 | `/signin` page with the demo-front-door notice | 1 h |
| 3 | Routing gate on `/leads`, dev-only | 30 min |
| 4 | Shell layout: toolbar | 45 min |
| 5 | Sidebar: items, disabled placeholders, cookie-backed collapse | 1.5 h |
| 6 | Table restructured to six columns | 1.5 h |
| 7 | Visual pass: rows, headers, borders, pills | 1.5 h |
| 8 | Remove the switcher; `#funnel` anchor; layout metadata | 30 min |
| 9 | Fix the action-id fetch in `prove-permissions.ts` | 15 min |
| 10 | New tests (below) | 45 min |
| 11 | Full verification, both roles, every feature | 1 h |

## Test cases

Existing tests are unchanged. These are additions.

| # | Given | When | Then |
|---|---|---|---|
| 1 | No `dev-user` cookie, development | the cookie-presence helper | Reports "not chosen" |
| 2 | A cookie naming a known user | the helper | Reports "chosen" |
| 3 | A cookie naming an unknown id | the helper | Reports "not chosen" |
| 4 | Production, any cookie | the helper | Reports as production — no gate, no redirect |
| 5 | A `dev-user` cookie set | `clearDevUser()` in development | The cookie is cleared |
| 6 | Production | `clearDevUser()` | Inert, exactly like `setDevUser` |
| 7 | All seven existing `auth.test.ts` cases | unchanged | Still pass, unmodified |

Rung 4 must re-cover, in the browser, as both roles: the table, the funnel, move
stage, assign owner, add note, create a lead, archive and unarchive, the sidebar
collapse surviving a reload, the disabled items being inert, and sign out
returning to `/signin`.

## Open questions

All resolved before implementation.

| # | Question | Decision |
|---|---|---|
| 1 | Practice name | **"SmileLoft Dental"** — capital L, that is how they spell it. |
| 2 | Does the Notes column survive? | **Kept, showing only the most recent note, truncated to one line, with the full text in a `title` attribute.** Removes the main cause of the horizontal scroll without losing information, and truncation is presentation rather than behaviour — which is what this spec is for. |
| 3 | Sidebar on first visit | **Expanded**, so the shape of the product is legible once. |
| 4 | Where `/` points | **Stays at `/leads`.** The redirect chain covers the rest: not signed in, `/leads` sends you to `/signin`. One rule, and once signed in you land on the work rather than clicking through a screen every time. |

## Changelog

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Plan written | Claude |
| 2026-08-19 | Four open questions decided; Notes column kept but truncated to the most recent note | shubham |
| 2026-08-19 | **Plan approved** | shubham |
