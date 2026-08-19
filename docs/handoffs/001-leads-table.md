# 001 — Leads table for a dental practice

- **Date:** 2026-08-19
- **Spec:** `docs/specs/0001-leads-table.md` (status: approved)
- **Branch:** development
- **Last commit at handoff:** `81693b4` — uncommitted at time of writing:
  `scripts/prove-permissions.ts`, `package.json`, `docs/STACK.md`,
  `docs/specs/0001-leads-table.md`, this file.

## What was asked

Set the project up the way this repo works (`/harness`), record the stack
(`/stack`: Next.js, TypeScript, MongoDB in Docker, Tailwind), then spec and
build a leads table for a dental practice: columns name, email, phone,
location, treatment interest, status, stage, owner; six stages (New, Contacted,
Consult Booked, Treatment Planned, Won, Lost); row actions to change stage,
assign owner and add a note; two roles where an admin sees every lead and an
agent sees only their own.

## What was done

### Setup
- `docker-compose.yml` — MongoDB 8, named volume `mongo-data`, port 27017.
- `.env.example` (committed) and `.env.local` (gitignored) holding `MONGODB_URI`.
- `.gitignore` — added `!.env.example`; the existing `.env*` rule was hiding it.
- `package.json` scripts: `test`, `typecheck`, `seed`, `prove:permissions`.
- `vitest.config.mts` — loads `.env.local`, aliases `@/*` and `server-only`.
- Dependencies added: `mongoose`, `server-only`; dev: `vitest`, `tsx`.

### Application
| File | What it is |
|---|---|
| `src/lib/db.ts` | Mongoose connection cached on `globalThis`; a failed connect is evicted so a Mongo restart does not poison every later request. |
| `src/models/lead-enums.ts` | `STAGES`, `STATUSES` and their types. No `server-only` — the client imports these. |
| `src/models/Lead.ts` | Schema, enums, `ownerId` index, notes subdocuments. `server-only`. |
| `src/lib/users.ts` | Hardcoded `USERS` (Priya Shah/admin, Tom Reid/agent). No `server-only`. |
| `src/lib/auth.ts` | `getCurrentUser()` (React `cache`), `setDevUser()`, `isDevSwitcherEnabled()`. `server-only`. |
| `src/lib/leads.ts` | Data access layer: `scopeFor()`, `listLeads()`, `setStage()`, `assignOwner()`, `addNote()`. `server-only`, **not** an endpoint. |
| `src/app/leads/actions.ts` | The `"use server"` boundary — three thin form adapters. |
| `src/app/leads/page.tsx` | The table, acting user, lead count, archived toggle. |
| `src/app/leads/lead-row.tsx` | Row controls via `useActionState`. |
| `src/app/leads/dev-user-switcher.tsx` | Dev-only switcher; a Server Component with a plain form. |
| `src/app/page.tsx` | Redirects `/` to `/leads`. |
| `scripts/seed.ts` | 12 leads across all six stages, both statuses, one unowned. Idempotent. |
| `scripts/prove-permissions.ts` | Live proof that the server, not the UI, enforces the rule. |

Tests: `src/lib/db.test.ts`, `src/models/Lead.test.ts`, `src/lib/auth.test.ts`,
`src/lib/leads.test.ts` — 36 tests.

### The permission model
`scopeFor(user)` returns `{}` for an admin and `{ ownerId: user.id }` for an
agent, and is merged into every read and write filter, so an agent acting on
someone else's lead matches zero documents. `assignOwner` carries a second,
separate rule: `role === 'admin'`, checked before anything else — an agent is
refused even on their own lead. Inside every mutation the order is: identify →
authorise → locate within scope → **then** validate the payload, so a caller who
may not touch a lead is refused identically whether their payload is valid,
invalid or empty. Refusals and missing records both return "Lead not found."

## What was deliberately not done

- **Real authentication.** `getCurrentUser()` is the single seam; it returns a
  hardcoded user. Everything else reads identity only from it. This is a
  prerequisite for any deploy.
- **Creating or editing leads through the UI.** Seed data only. A create form is
  a second feature with its own validation rules.
- **Deleting leads.** Archive is the delete; nothing is removed.
- **An archive/unarchive row action.** Not one of the three actions named. The
  status column and the archived filter both work.
- **Pagination, sorting, search, owner filter.** Speculative at unknown volume.
- **Note editing/deleting, audit log, notifications, bulk actions, export,
  real-time, mobile layout.** None were asked for.
- **PII protections beyond the ownership scope** (encryption at rest, GDPR
  export/erasure). Local Mongo currently runs with auth disabled. This must be
  settled before real patient data.

Full reasoning for each is in the spec's "Out of scope, deliberately" table.

## What is still open

- Auth, deploy target, and whether production uses hosted MongoDB. `docs/STACK.md`
  leaves `deploy` blank on purpose.
- `db migrate` is blank because Mongoose has no migration step.
- **The redundant ownership scope in the write filters is not covered by any
  test.** The scope appears in both the pre-check and the `updateOne` filter;
  removing it from the write filter alone leaves every test green, because the
  pre-check already blocks. It is defence against a stale read and against a
  future edit dropping the pre-check. I could not find a way to cover it that
  did not amount to asserting the implementation's own shape. Decision was to
  leave it in and say it is unproven.
- Production behaviour has never been observed. The `NODE_ENV` guards are proven
  by unit test and by deleting them, but no production build has been served.
- No accessibility pass, no cross-browser check. All visual verification was
  headless Chrome at 1500×1000.
- `treatmentInterest` is free text; promote to an enum when the practice's real
  treatment list is known.

## How to verify it

```bash
docker compose up -d     # Mongo
npm install
npm run seed             # 12 leads, safe to re-run; resets the demo data
npm run dev              # http://localhost:3000 -> redirects to /leads
npm run lint && npm run typecheck && npm test && npm run build
npm run prove:permissions   # needs the dev server running
```

`npm run prove:permissions` sends the `assignOwner` action straight at the
server as the agent, bypassing the page, and asserts it is refused *and* the
stored record is unchanged. It includes an admin control case: if the admin's
identical request does not succeed, the request was malformed and the script
reports FAIL rather than a false PASS.

In the browser: switch between Priya and Tom with the "Dev only" control. The
count in the header changes 10 → 7 (or 12 → 9 with archived shown). That number
is the visible evidence the scope is real.

## Things the next person would otherwise rediscover the hard way

1. **This is Next.js 16.3.1 and it differs from most training data.** Read
   `node_modules/next/dist/docs/` — `AGENTS.md` says so and it is correct.
   `searchParams` is a `Promise` and must be awaited. `forbidden()` and
   `unauthorized()` exist but are experimental and need
   `experimental.authInterrupts`; they are not used here.
2. **Mongoose 9 renamed `FilterQuery` to `QueryFilter`.** The old name does not
   exist.
3. **`server-only` throws outside the `react-server` condition.** Vitest does not
   set it, and setting `resolve.conditions` does not help because the package is
   externalised and resolved by Node — hence the alias to its own `empty.js` in
   `vitest.config.mts`. Scripts run with `node --conditions=react-server`.
4. **Plain `node` cannot run the scripts.** It will not resolve extensionless
   TypeScript imports, which is why `tsx` is a dev dependency. That is the whole
   reason it exists here.
5. **Constants shared with the client cannot live in a `server-only` module.**
   This is why `lead-enums.ts` and `users.ts` are separate from `Lead.ts` and
   `auth.ts`. Importing `Lead.ts` from a client component fails the build —
   verified by deliberately doing it.
6. **Server action ids change every build.** `scripts/prove-permissions.ts`
   discovers the live id by fetching the page and grepping the served chunks.
   Hardcoding one from a previous build gives `404 Server action not found`,
   which looks like a passing security test but tests nothing.
7. **The multipart body for a `useActionState` form action is order-sensitive.**
   The arguments field is named `"0"`, and because that is an integer-like key,
   building the parts as an object literal silently hoists it to the front and
   the action dies with "Connection closed." `prove-permissions.ts` uses an
   array of pairs for that reason.
8. **A security test that has never been seen to fail is not evidence.** Two
   tests in this build passed for the wrong reason and were caught only by
   deleting the rule they covered: the `setDevUser` production test (it posted
   an invalid user id, so the id check refused it and the `NODE_ENV` guard was
   never exercised) and the first bypass attempt (both roles were refused
   because the request was malformed). Every security rule here has been
   verified by deletion.
9. **React clears an uncontrolled form once the action resolves.** A failed note
   would silently vanish, so `addNoteAction` returns the rejected text and the
   input refills from it.
10. **An uncontrolled `<select>` keeps its DOM value across a post-action
    re-render.** The switcher dropdown disagreed with the header until
    `key={current.id}` was added to force a remount. Only visible in a browser;
    every test was green.
11. **`npm test` fails with no test files.** `vitest run` has no
    `--passWithNoTests`; it goes green with the first test. This was a
    deliberate choice to keep the script string as specified.
12. Chrome was driven for visual checks over the DevTools Protocol using Node's
    built-in WebSocket — no Playwright, no new dependency. The throwaway driver
    lived in the session scratchpad and was not kept.
