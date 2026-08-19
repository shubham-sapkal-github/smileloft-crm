# 0003 — Add a single lead

- **Status:** approved
- **Date:** 2026-08-19
- **Author:** shubham (with Claude)
- **Builds on:** `docs/specs/0001-leads-table.md`, `docs/specs/0002-funnel-view.md`
- **Reverses:** the "creating and editing leads through the UI" row in spec 0001

## The requirement, in my own words

Add a plain HTML form on `/leads` that creates one lead — name, email, phone,
location, treatment interest — posting to a Server Action the way the dev
switcher already does. No modal library, no form library, no new dependency.

Validation matches the rest of the app: name required, at least one of email or
phone. New leads are always stage `New` and status `Active`.

Ownership is derived from the caller: an agent's new lead is owned by that
agent; an admin's starts **unassigned**, because an admin adding a lead is
usually recording an enquiry for somebody else to pick up. **Every user may
create** — reception, agents and admins all record enquiries in a real practice,
so there is no role restriction on this action.

All of it lives in **one shared `createLead()` in `src/lib/leads.ts`**, beside
the other writes, so validation and permissions stay in one place. The
spreadsheet-paste feature coming next calls that same function instead of a
second copy of the rules.

After a create, the table and the funnel both update without a reload.

## Mass assignment protection

This is the security property of this spec, and it is not the same one the
other writes have.

Every existing write is guarded by **ownership of a record that already
exists** — `scopeFor(user)` merged into the filter. A lead being created has no
owner yet, so there is nothing of that kind to check. The equivalent guarantee
here is:

> `ownerId`, `stage` and `status` are set from the server's view of the caller
> and are **never** read from the submitted form.

An agent who posts `ownerId=u_admin`, `stage=Won`, `status=Archived` still gets
a lead owned by themselves, at stage `New`, status `Active`. This is **mass
assignment protection**: the danger is not a missing check but an *extra field*
quietly reaching the database because the code spread the whole payload into the
document.

It is implemented as an **allow-list** — the five text fields are read out by
name, one at a time, and nothing else in the form is looked at. A deny-list of
fields to strip would be wrong for the usual reason: it is only ever as complete
as the last person to update it, and adding a sensitive field to the schema
would silently open a hole.

## In scope

- `createLead(input)` in `src/lib/leads.ts` — one lead, field-keyed errors.
- `createLeadAction` adapter in `src/app/leads/actions.ts`.
- A form in a native `<details>` disclosure on `/leads`, above the table.
- Server-derived owner (`null` for admins, the caller for agents), stage `New`,
  status `Active`.
- Length caps on the text fields, added to the schema so the rule has one home.
- **Refilling the form from the submitted values when a create fails.**
- **Archive and unarchive as a row action**, same shape and permission rule as
  `setStage`.
- **A seed that resets**: `npm run seed` removes any lead it did not create, so
  the database returns to a known state before a demo.
- Updating spec 0001's out-of-scope row to point here, and a line in
  `docs/DECISIONS.md` recording the reversal and why.

## Out of scope, deliberately

| Thing | Why not | What happens instead |
|---|---|---|
| The spreadsheet paste itself | It is the next spec. What this one owes it is a function it can call without the rules being rewritten — that seam is built here, the feature is not. | `createLead()` takes one lead and returns field-keyed errors, so paste can map over it and report per row. Batching can move inside it later without any caller changing. |
| Bulk `createLeads([...])` | Building the plural case now means complicating the only caller that exists for the sake of one that doesn't. | Single-lead function. If a 200-row paste proves slow, the batching goes inside `createLead`'s implementation, not into its signature. |
| Editing an existing lead | This spec is create. Edit is a different set of questions — which fields are editable, by whom, and whether changes are recorded. | The three row actions remain the only way to change a lead. |
| Duplicate detection ("this email already exists") | Needs a matching rule (email? phone? name and town?) and a merge or ignore UI, and getting it wrong either blocks a real enquiry or silently merges two patients. | Duplicates are accepted. Nothing prevents adding the same person twice. |
| Email and phone **format** validation | The rule everywhere else is presence, not shape. A phone number typed with spaces, a `+44`, or an extension is still a phone number, and rejecting a real enquiry because a regex disliked it loses the lead — which is exactly the failure the "at least one contact" rule exists to prevent. | Presence only, plus a length cap. |
| ~~An archive/unarchive row action~~ — **moved into scope** | Was out of scope in spec 0001 because it was not one of the three named actions. Two things changed: `status` is a column the app displays but offers no way to change, so archived leads exist only because the seed made them; and a create form makes mistakes easy to produce with no way to undo them. Archiving is the correct undo for a CRM — a practice does not delete a patient record, it files it away. | Built here. |
| An admin choosing the owner while creating | Admin-created leads start unassigned by decision, and the assign action already exists to hand one over. Two ways to set an owner is one too many. | Create, then assign from the row. |
| Choosing a stage or status at creation | Everything starts at the beginning of the pipeline; a lead created directly at `Won` is a data-entry mistake, not a feature. | Always `New` / `Active`. |
| Adding a note while creating | The note action exists on the row. | Create, then add the note. |
| Deleting a lead | Spec 0001 ruled this out and nothing here changes it: a practice does not delete a patient record. | Archiving is the undo, and it is now built. |
| Rate limiting, CAPTCHA, spam protection | This form is behind the practice's internal screen, not on the public website. The moment it is exposed publicly this becomes a real requirement. | Nothing. Noted here so the assumption is visible if the form is ever reused. |
| A toast/notification system | One inline message next to the form says what happened. | Plain text in the form. |

## Approach

| File | Change |
|---|---|
| `src/models/Lead.ts` | Add `maxlength` to the five text fields. Update the stale comment on the `pre("validate")` hook — it currently says the write paths never touch the contact fields, which stops being true with this spec. |
| `src/lib/leads.ts` | Add `createLead()`, `NewLeadInput`, `CreateResult`, and `setStatus()`. |
| `src/app/leads/actions.ts` | Add `createLeadAction`, reading the five fields **by name**, and `setStatusAction`. |
| `src/app/leads/add-lead-form.tsx` | **New.** Client Component using `useActionState`, inside a `<details>`. |
| `src/app/leads/page.tsx` | Mount it below the funnel and above the table. |
| `src/app/leads/lead-row.tsx` | Archive / Unarchive control on each row. |
| `scripts/seed.ts` | Remove leads it did not create, so a re-run resets the database. |
| `src/lib/leads.test.ts` | The new cases. |
| `docs/specs/0001-leads-table.md` | Repoint the out-of-scope row. |
| `docs/DECISIONS.md` | Record the reversal. |

### `createLead()`

```
createLead(input: NewLeadInput): Promise<CreateResult>

NewLeadInput = { name, email, phone, location, treatmentInterest }  // strings

CreateResult =
  | { ok: true; id: string }
  | { ok: false; errors: Partial<Record<keyof NewLeadInput, string>>;
      values: NewLeadInput }
```

Order inside it, matching the other writes:

1. `connectToDatabase()`, `getCurrentUser()` — identity first, always.
2. Derive `ownerId`: `user.role === "admin" ? null : user.id`. Never from input.
3. Build the document from the five named fields plus `stage: "New"`,
   `status: "Active"`.
4. `Lead.create(...)`, letting the schema validate.
5. On `mongoose.Error.ValidationError`, translate to field-keyed messages and
   return them **with the submitted values**.
6. `revalidatePath("/leads")` on success.

### Validation stays in one place

The rule — name required, at least one of email or phone, plus the new length
caps — is already defined once, in the schema. `createLead()` does **not**
re-implement it; it catches Mongoose's `ValidationError` and maps
`error.errors[path].message` onto the field keys the form needs. One definition,
two presentations. Re-checking it by hand in the function would guarantee the
two drift apart, and the copy in the function would be the one that goes stale.

### Keeping what was typed

React clears an uncontrolled form once the action resolves. This bit us on the
note field in spec 0001, and it is worse here: someone who filled in five fields
and got back "a lead needs at least one of email or phone" must not lose the
other four.

Same fix as the note, which is why `CreateResult` carries `values`: on failure
the action returns what was submitted, and each input's `defaultValue` is
refilled from it, remounted by `key` so the new default takes effect. **This
gets a test** — it is invisible until it fails, and when it fails a person
retypes everything.

### Archiving

`setStatus(leadId, status)` is a direct copy of `setStage`'s shape, deliberately:
identity, then locate the lead **within `scopeFor(user)`**, then validate the
status against `STATUSES`, then a scoped write. An agent can archive and
unarchive their own leads and nobody else's; an admin can do either to any lead.
There is no new permission concept here, which is the point — a fourth row
action that invented its own rule would be a fourth thing to get wrong.

The control is one button whose label depends on the lead's current status:
"Archive" on an Active lead, "Unarchive" on an Archived one. Archiving a lead
while the archived view is hidden makes the row leave the table, which is
correct and is what filing it away means.

### A seed that resets

`npm run seed` currently upserts its twelve leads and leaves anything else
alone, so a lead added by hand survives a re-run and there is no way to get back
to a known state before a demo. It will now also **delete every lead it did not
create**, matched by the fixture names it owns.

That is a destructive operation, so it carries a guard: the script **refuses to
run against anything other than a local database**, checked on the host in
`MONGODB_URI`. Wiping a demo database is a fine thing to do by accident; wiping
a hosted one is not, and the difference between them is one environment
variable. It prints what it removed rather than doing it silently.

### Where it sits

Below the funnel, above the table, in a `<details>` disclosure — a native
element, so it opens with no JavaScript and needs no modal library. The summary
reads "Add a lead". On success the form clears and shows an inline confirmation,
and the disclosure stays open, because reception adding one enquiry usually has
another.

## Edge cases

| Case | Expected behaviour |
|---|---|
| Agent creates a lead | Owned by that agent. It appears in their table and funnel immediately. |
| Admin creates a lead | `ownerId` is `null`. Visible to admins; **no agent sees it** until an admin assigns it. |
| Agent posts `ownerId`, `stage`, `status` | All three ignored. Owner is the agent, stage `New`, status `Active`. |
| Any other unexpected field posted | Never read. The five fields are taken by name. |
| Name empty or whitespace only | Rejected, error keyed to `name`, nothing stored, values returned. |
| Name given, both email and phone empty | Rejected, error keyed to `phone` (the schema's message), nothing stored, values returned. |
| Everything empty | Both errors returned together, not one at a time. |
| A field over its length cap | Rejected with a field error; the cap lives in the schema. |
| Duplicate of an existing lead | Accepted. Out of scope, by decision. |
| Successful create while "Show archived" is on | The lead is `Active`, so it appears in both views. |
| Successful create | Table gains a row and the funnel's `New` count rises by one, on the same revalidation — neither may lag the other. |
| Database unreachable mid-create | The action returns an error and the typed values come back. Nothing typed is lost. |
| Agent archives a lead they own | Status becomes `Archived`; the row leaves the default table view and the funnel recounts without it. |
| Agent tries to archive a lead they do not own | Refused with the same generic "Lead not found." as every other cross-owner write. Stored record unchanged. |
| Unarchiving | Status returns to `Active` and the lead reappears in the default view. |
| A status that is neither `Active` nor `Archived` | Rejected against `STATUSES`, nothing stored. |
| `npm run seed` run twice with a hand-added lead present | The twelve fixtures are reset and the hand-added lead is removed. The database is in a known state either way. |
| `npm run seed` pointed at a non-local `MONGODB_URI` | Refuses to run and changes nothing. |

## Permissions

| Who | May create | Resulting owner |
|---|---|---|
| Admin | Yes | Unassigned (`null`) |
| Agent | Yes | Themselves |

Archiving follows the existing rule exactly:

| Who | May archive / unarchive |
|---|---|
| Admin | Any lead |
| Agent | Only leads they own — refused with the same generic message otherwise |

There is no role restriction, by decision. The server-side guarantee is not
"who may call this" but **what the caller may set**: owner, stage and status come
from `getCurrentUser()` and the code, never from the form. Once created, the lead
is subject to the ordinary `scopeFor(user)` rule for every read and write that
follows.

`createLeadAction` is a new POST-able endpoint, so it is written on the
assumption that it will be called directly, without the form.

## Subtasks

| # | Task | Estimate |
|---|---|---|
| 1 | `maxlength` on the schema fields; fix the stale comment | 20 min |
| 2 | `createLead()` + types in `src/lib/leads.ts` | 1 h |
| 3 | `createLeadAction` in `actions.ts` | 20 min |
| 4 | `add-lead-form.tsx`, including refill-on-failure | 1.5 h |
| 5 | Mount in `page.tsx` | 15 min |
| 6 | Tests (see below) | 1 h |
| 6b | `setStatus()` + archive control on the row | 1 h |
| 6c | Seed removes what it did not create, with the local-database guard | 40 min |
| 7 | Update spec 0001's out-of-scope row and `docs/DECISIONS.md` | 15 min |
| 8 | Verification per `docs/VERIFICATION.md`, both roles in the browser | 45 min |

## Test cases

| # | Given | When | Then |
|---|---|---|---|
| 1 | Acting as an agent | `createLead` with valid input | Stored lead's `ownerId` is that agent |
| 2 | Acting as an admin | `createLead` with valid input | Stored lead's `ownerId` is `null` |
| 3 | Acting as an agent | input also carrying `ownerId: admin`, `stage: "Won"`, `status: "Archived"` | Stored lead is owned by the **agent**, stage `New`, status `Active` — mass assignment blocked |
| 4 | Any user | name empty | `ok: false`, error keyed to `name`, collection unchanged |
| 5 | Any user | name given, no email and no phone | `ok: false`, error keyed to `phone`, collection unchanged |
| 6 | Any user | a failing create | The result's `values` equal what was submitted, so the form can refill |
| 7 | Any user | a field over its cap | `ok: false`, error keyed to that field |
| 8 | Any user | valid input with padded whitespace | Stored values are trimmed; stage `New`, status `Active` |
| 9 | Admin creates, then an agent lists | `listLeads` as the agent | The admin's unassigned lead is **not** in the agent's list |
| 10 | A created lead | `buildFunnel` over the agent's list | The `New` count includes it |

| 11 | A lead owned by another agent | agent calls `setStatus` on it | Refused; stored status unchanged |
| 12 | A lead the agent owns | agent archives it | Stored status is `Archived`; it leaves the default `listLeads` result |
| 13 | An archived lead the agent owns | agent unarchives it | Stored status is `Active` |
| 14 | Any lead | `setStatus` with `"Binned"` | Refused; stored status unchanged |
| 15 | A hand-added lead in the database | `npm run seed` | It is removed; the twelve fixtures remain |

Case 3 is the one that matters. If it ever passes while the stored document
carries a client-supplied owner, the rest of the permission model is decoration.
It is to be verified by deletion, like the other security rules in this project:
spread the whole input into the document and confirm the test goes red.

## Open questions

All resolved before implementation.

| # | Question | Decision |
|---|---|---|
| 1 | Does the `<details>` stay open after a successful create? | **Stays open**, form cleared, inline confirmation. Reception adding one enquiry usually has another. |
| 2 | Does the confirmation name the lead? | **Yes** — "Added Alice Bennett". No more work and more reassuring than a generic message. |
| 3 | Archive/unarchive — this spec or separate? | **This spec.** *(Your call.)* `status` is displayed with no way to change it, and a create form makes mistakes easy to produce with no undo. Archiving is the correct undo for a CRM. |
| 4 | Length caps | **200 characters** on all five text fields. Long enough for any real name, town or treatment description; short enough that the field is not a place to paste an essay. |

## Changelog

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Plan written | Claude |
| 2026-08-19 | Archive/unarchive moved into scope; seed made to reset the database; open questions 1, 2 and 4 taken as their defaults | shubham |
| 2026-08-19 | **Plan approved** | shubham |
