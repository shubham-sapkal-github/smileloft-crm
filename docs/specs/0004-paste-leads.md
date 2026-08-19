# 0004 — Paste multiple leads from a spreadsheet

- **Status:** approved — **not implemented.** Built live, deliberately.
- **Date:** 2026-08-19
- **Author:** shubham (with Claude)
- **Builds on:** `docs/specs/0003-add-lead-form.md`

## The requirement, in my own words

Add a paste box on `/leads` for bulk-adding leads copied out of Google Sheets or
Excel. A spreadsheet copy arrives on the clipboard as **plain text: tabs between
columns, newlines between rows**, so this is a `<textarea>` and a split — no
file upload, no spreadsheet library, no new dependency.

Row one is a header. Column names are matched to fields case-insensitively and
ignoring spaces and punctuation, so `Treatment Interest` and
`treatment_interest` both land on `treatmentInterest`. Columns that cannot be
matched are **named back to the person** rather than guessed at. If no column
matches any known field, the answer is "the header row is missing", not
silently treating row one as a patient.

Before anything is written, a preview shows **every** parsed row — including the
ones that fail validation, each with its reason beside it. On confirm, the valid
rows are imported and the result says exactly what happened: how many created,
how many skipped, and why each was skipped. Importing 8 of 10 and saying so
beats importing 8 silently.

Every row goes through the existing `createLead()`, so validation, ownership and
mass assignment protection stay in the one place they already live. The paste is
size-capped, and exceeding the cap says so.

## Only five columns are ever read

The same danger as spec 0003, arriving by a different door. A spreadsheet is
very likely to have an `Owner`, `Stage` or `Status` column — people export those
from whatever system they are leaving. **None of them are matchable.** The
header matcher knows exactly five field names, and any other column is reported
as unrecognised and its values are never read.

An `Owner` column full of names therefore changes nothing: the imported leads
are owned by whoever pasted them, exactly as if they had been typed into the
form. This is the same allow-list rule as `createLead()` — a deny-list of column
names to ignore would only ever be as complete as the last person to update it.

## Known limitation: re-pasting duplicates

Duplicate detection is out of scope (see below), and partial import is the whole
point of this feature, so these two combine into a trap worth stating plainly:

> Paste ten rows, have eight imported and two skipped, fix the two in the
> spreadsheet, and paste the **whole sheet** again — and the eight that
> succeeded are created a second time.

Nothing in this feature prevents that. The correct move after a partial import
is to paste **only the rows that were skipped**, which is why the import report
must make it obvious which rows those were. If this proves to be a real
foot-gun in use, the fix is duplicate detection — which needs the practice's own
rule for what counts as the same patient before it can be built at all.

## In scope

- A `<textarea>` on `/leads` accepting tab-separated text, beside the add form.
- Header matching against the five field names, case- and punctuation-
  insensitive, with unrecognised columns named back.
- A "header row is missing" answer when nothing matches.
- **Server-side dry run** producing a preview of every row with per-row errors.
- Import of the valid rows via `createLead()`, one row at a time.
- A report: created, skipped, and the reason per skipped row.
- Row and character caps enforced **in the action**.
- A warning when the text contains quoted cells.

## Out of scope, deliberately

| Thing | Why not | What happens instead |
|---|---|---|
| **Duplicate detection** | It needs a rule for what counts as the same patient — same email? same phone? same name and town? — and that is a decision for the practice, not for me. Guessing it wrong either blocks a genuine second enquiry from the same household or silently merges two different people. | Every valid row is created. Re-pasting the same sheet creates duplicates; see the known limitation above. |
| A real TSV/CSV parser (quoted cells, embedded tabs and newlines) | Handling `"John ""Jack"" Smith"` and cells containing line breaks properly means a quoting state machine — which is exactly the dependency this feature exists to avoid. | Split on tabs and newlines. If a `"` appears anywhere in the text, **warn** that quoted cells are not supported — and still show the preview, because a name like `John "Jack" Smith` trips the check without being a problem, and the person can see the parsed rows before anything is written. |
| File upload (`.csv`, `.xlsx`) | A different input with different problems: encodings, multiple sheets, binary formats, a parser dependency. Pasting is what people actually do with a spreadsheet on screen. | Paste only. |
| A column-mapping UI ("this column is Phone") | Real feature with real design. Renaming a header in the spreadsheet and pasting again costs the user seconds. | Unrecognised columns are named; the fix is renaming the header. |
| Editing rows inside the preview | It turns a preview into a spreadsheet editor, and the source of truth is the spreadsheet the person already has open. | Fix it in the spreadsheet, paste again. |
| Transactional / all-or-nothing import | Explicitly not wanted: two bad rows should not discard eight good ones. | Partial import, fully reported. |
| Undo / rollback of an import | Needs a record of which leads came from which import. That is an import history feature. | Archiving exists per lead (spec 0003). A mistaken import is archived row by row. |
| Import history or an audit of who imported what | Same family as the stage-change log deferred in spec 0002 — worth building once, properly, not twice badly. | Nothing recorded beyond the leads themselves. |
| Updating existing leads from a paste (upsert) | Requires duplicate detection first, and then a rule about which side wins on conflict. | Import creates. It never modifies an existing lead. |
| Owner, stage, status or notes columns | Deliberate: see "Only five columns are ever read". Accepting an owner from a spreadsheet is mass assignment with extra steps. | Reported as unrecognised columns. Ownership follows the caller, as in the form. |
| Background processing for large pastes | The 200-row cap keeps the work inside one request. | Anything larger is refused with a message saying so. |

## Approach

Nothing here is built yet. This is the shape it should take.

| File | Responsibility |
|---|---|
| `src/lib/paste.ts` | **New.** Pure parsing: `parsePaste(text)` → header mapping, rows, unrecognised columns, warnings. No database, no `server-only` — a pure function is what makes the parsing cheap to test exhaustively. |
| `src/lib/leads.ts` | `previewPaste(text)` (dry run) and `importPaste(text)`. Beside the other writes, for the same reason as `createLead`. |
| `src/app/leads/actions.ts` | `previewPasteAction`, `importPasteAction`. Caps enforced here. |
| `src/app/leads/paste-leads.tsx` | **New.** Client Component in a `<details>`, beside the add form. Textarea → preview → confirm. |
| `src/lib/paste.test.ts` | The parsing, exhaustively. |
| `src/lib/leads.test.ts` | Dry run and import cases. |

### Parsing

1. Normalise line endings — Excel on Windows pastes `\r\n`. Strip a leading BOM.
2. Split rows on newlines, drop trailing blank lines, split cells on tabs.
3. Normalise each header cell: lowercase, remove everything that is not a
   letter or digit. `Treatment Interest`, `treatment_interest` and
   `TREATMENTINTEREST` all become `treatmentinterest`.
4. Match against the five normalised field names. Anything else goes into
   `unrecognisedColumns`.
5. If **no** header cell matches any field, return a "header row not
   recognised" result naming the columns that were found. Row one is never
   treated as data.
6. Rows with fewer cells than the header: missing values are empty strings.
   Rows with more: the extra cells are ignored and counted in a warning.

### Preview: a server-side dry run

The preview must show why a row will fail, and "why a row fails" is defined by
the Mongoose schema — the single definition spec 0003 went out of its way to
keep. So the preview does **not** re-check the rules in its own code. It builds
each candidate document and validates it with the schema **without saving**
(`new Lead({...}).validateSync()`), then reports the same messages the form
shows.

The preview is a **view, not a contract**. On confirm, the raw text is posted
again and **re-parsed on the server**; nothing the client posts back as "the
rows" is trusted or written. Parsing twice costs nothing and removes the
question entirely.

### Import

Loop the valid rows through `createLead()` — one row, one call — collecting each
result. `createLead()` already derives owner, stage and status from the caller,
so the ownership rule is inherited rather than restated: **an agent's imported
leads are owned by them; an admin's are all unassigned.**

`createLead()` currently calls `revalidatePath("/leads")` on every success, which
a 50-row import would do 50 times. It needs an option to skip that, with the
import revalidating **once** after the batch. That is a small change to
`createLead`'s signature and should be visible in the diff, not smuggled in.

### Caps

| Cap | Value | Where |
|---|---|---|
| Rows | 200 | Checked in the action |
| Characters | 100,000 | Checked in the action |

Both are enforced **in the action**, not by `maxlength` on the textarea: the
action is POST-able directly, so an attribute in the markup is a courtesy to the
person typing, not a control. Exceeding either says which cap was hit and how
far over it is.

## Edge cases

| Case | Expected behaviour |
|---|---|
| Empty textarea | "Nothing to import." Nothing parsed, nothing written. |
| Header only, no data rows | Preview shows zero rows and says so. Import is not offered. |
| No column matches any field | "Header row not recognised", listing the columns found. Row one is never imported as a patient. |
| Some columns unrecognised | Preview proceeds using the matched ones, and names the unrecognised columns explicitly. |
| Windows line endings (`\r\n`) | Parsed identically to `\n`. |
| Trailing blank lines / trailing tab | Ignored, not parsed as an empty patient. |
| A row with fewer cells than the header | Missing fields are empty; ordinary validation then decides. |
| A row with more cells than the header | Extra cells ignored, with a warning saying how many rows were affected. |
| Text contains a `"` | Warning that quoted cells are unsupported. **Not blocked** — `John "Jack" Smith` is a real name and the preview shows what will be written. |
| A row fails validation | Shown in the preview with its reason, and skipped at import. The others still import. |
| A row fails at write time, not validation | Counted as skipped with its error. The import continues. |
| Over 200 rows or 100,000 characters | Refused with the cap named and the actual size. Nothing written. |
| Admin imports | Every created lead is unassigned. |
| Agent imports | Every created lead is owned by that agent. |
| Import completes | Table and funnel both update, on one revalidation after the batch. |
| The same sheet pasted twice | Both imports create leads. See the known limitation. |

## Permissions

Unchanged, and inherited rather than restated. `importPaste` writes only through
`createLead()`, which derives owner, stage and status from `getCurrentUser()`.

| Who | May import | Resulting owner |
|---|---|---|
| Admin | Yes | Unassigned |
| Agent | Yes | Themselves |

`previewPasteAction` and `importPasteAction` are new POST-able endpoints and are
to be written on the assumption that they will be called directly, without the
UI — which is why the caps live in them and why the import re-parses rather than
trusting posted rows.

## Subtasks

| # | Task | Estimate |
|---|---|---|
| 1 | `parsePaste()` in `src/lib/paste.ts` | 1.5 h |
| 2 | `src/lib/paste.test.ts` | 1 h |
| 3 | `previewPaste()` dry run via `validateSync` | 1 h |
| 4 | `createLead()` revalidate option; `importPaste()` batch loop | 45 min |
| 5 | Actions with both caps | 30 min |
| 6 | `paste-leads.tsx` — textarea, preview table, confirm, report | 2 h |
| 7 | Tests for dry run and import | 1 h |
| 8 | Verification per `docs/VERIFICATION.md`, both roles in the browser, with text copied from a real spreadsheet | 45 min |

## Test cases

| # | Given | When | Then |
|---|---|---|---|
| 1 | `Name\tEmail` header and two rows | `parsePaste` | Two rows mapped to `name` and `email`, no unrecognised columns |
| 2 | Header `Treatment Interest`, `treatment_interest`, `TREATMENTINTEREST` | `parsePaste` | All three map to `treatmentInterest` |
| 3 | Header with an `Owner` column | `parsePaste` | `Owner` is listed as unrecognised; its values are not read |
| 4 | A sheet with no recognisable header | `parsePaste` | "Header row not recognised", the found columns are named, no rows are returned as data |
| 5 | `\r\n` line endings | `parsePaste` | Identical result to `\n` |
| 6 | Trailing blank lines | `parsePaste` | No empty row is produced |
| 7 | A row with fewer cells than the header | `parsePaste` | Missing fields are empty strings |
| 8 | Text containing `"` | `parsePaste` | A warning is present and rows are still returned |
| 9 | Ten rows, two with no contact details | `previewPaste` | Ten rows previewed; the two carry the schema's message; nothing is written |
| 10 | The same ten rows | `importPaste` | Eight created, two skipped with reasons; the eight exist in the database |
| 11 | Acting as an agent | `importPaste` | Every created lead is owned by that agent |
| 12 | Acting as an admin | `importPaste` | Every created lead has `ownerId: null` |
| 13 | A sheet with an `Owner` column naming another user | `importPaste` | Created leads are owned by the caller, not by the column |
| 14 | 201 rows | the action | Refused, cap named, nothing written |
| 15 | 100,001 characters | the action | Refused, cap named, nothing written |

Cases 13, 14 and 15 are the ones to verify by deletion, like the other security
rules in this project: remove the guard and confirm the test goes red.

## Open questions

| # | Question | Decision |
|---|---|---|
| 1 | Aliases for header names — `Full Name` → `name`, `Mobile` → `phone`, `Town` → `location`? | **No aliases.** Matching is on the five field names only. An alias table is guessing dressed up as helpfulness, and the brief was to name unrecognised columns rather than guess. Renaming a header in the spreadsheet is seconds of work, and the preview says exactly which column was not understood. Revisit if real pastes keep tripping on the same two or three names. |
| 2 | Does the preview stay on screen after import? | **Replaced by the report**, which lists the skipped rows and their reasons — those are the rows the person needs in order to fix the sheet. |
| 3 | Is the paste box in the same `<details>` as the add form, or its own? | **Its own**, beside it. They are two ways to do one thing and one is much longer than the other. |

## Changelog

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Plan written | Claude |
| 2026-08-19 | Quoted cells warn rather than block; caps set at 200 rows / 100,000 characters in the action; revalidate once per batch | shubham |
| 2026-08-19 | **Plan approved — to be built live, not now** | shubham |
