# 0002 — Funnel view above the leads table

- **Status:** approved
- **Date:** 2026-08-19
- **Author:** shubham (with Claude)
- **Builds on:** `docs/specs/0001-leads-table.md`

## The requirement, in my own words

Add a funnel above the existing leads table on `/leads` — the same page, not a
new screen. It shows one bar per pipeline stage (New, Contacted, Consult Booked,
Treatment Planned, Won), the count at each, and the drop between each
consecutive pair.

Counts are **cumulative**: a lead at Treatment Planned is counted at New,
Contacted, Consult Booked and Treatment Planned. Bars therefore only ever
decrease, and the drop between two of them is a real conversion figure rather
than the difference between two unrelated snapshots.

**Lost is not a bar.** A funnel is the path from enquiry to treatment, and Lost
is where people fall out of it, so it is shown as a single separate number
beside the funnel.

The funnel obeys the same permission rule as the table, by the same mechanism:
it is built on the server from leads already scoped by `scopeFor(user)`, so an
agent sees a funnel of their own leads and an admin sees the whole practice. It
is never assembled from anything the client hands back.

The funnel follows the existing **Show archived** toggle, so the funnel and the
table always describe the same set of leads.

## Known limitations

Both of these are the same root cause, written down here because they are
invisible in the finished screen and someone will otherwise rediscover them by
disbelieving the numbers.

> **Superseded in part, 2026-08-19.** Two decisions below were reversed after
> the numbers were checked against real data: the funnel no longer drops Lost
> leads from the bars, and no longer follows the archived toggle. Both were
> making it report the practice as doing better than it was. `lostFromStage`
> now records where a lead was lost from. See the corrections at the end of
> this section and `docs/DECISIONS.md`.

### The funnel infers a history the data does not record

A lead record stores only its **current** stage. There is no record of the
stages it passed through — the audit log was deliberately out of scope in spec
0001. Cumulative counting therefore *infers* that a lead at stage N passed
through every stage before it.

That inference is wrong whenever a lead skips stages. A lead dragged straight
from New to Won is counted as having reached Consult Booked and Treatment
Planned, neither of which ever happened. Nothing in the UI distinguishes an
inferred pass-through from a real one, and no query can recover the difference
after the fact.

**Upgrade path:** a log of stage changes — one row per transition, with the
lead, the stage moved from and to, who moved it and when. The funnel would then
count leads that genuinely reached each stage instead of assuming it. That log
is **not** built here. Until it exists, treat these numbers as an estimate that
is accurate only to the extent that reception moves leads one stage at a time.

### The funnel cannot say which stage people are lost from

Setting a lead to Lost overwrites the stage it was at. The position where it
dropped out is gone, so a Lost lead cannot be attributed to any bar. This is why
Lost is a single number rather than a per-stage breakdown, and why "we lose most
people after the consult" is a question this screen **cannot** answer.

**Partly fixed, 2026-08-19.** `lostFromStage` on the lead records the stage it
was on when it was set to Lost, so the funnel now credits a lost lead with every
stage it genuinely reached. It is cleared if the lead is put back on the
pipeline. Leads lost *before* this field existed have no value and fall back to
counting at `New` only.

**Still open:** this is one field, not a history. It records only the most
recent loss, and nothing about the path taken before it. A full stage-change log
remains the upgrade path, and is what a per-stage breakdown of losses would
need.

### Corrections to the original decisions

| Originally | Now | Why |
|---|---|---|
| Lost leads excluded from every bar | Counted for every stage they reached; still never a bar of their own | Removing them shrank the denominator without touching the numerator, so **losing a patient improved the conversion shown for the stage they were lost from** — measured going 60% → 75% on real data. |
| Funnel follows the **Show archived** toggle | Funnel always counts every lead in scope; only the table follows the toggle | Archived means "treatment finished, filed away". Excluding those leads erased the practice's own wins: with both won patients archived the funnel read **Won 0**. A funnel that changes with a view filter is not a funnel. The page says so under the heading. |
| Between-bar figure labelled `−N · X% continue` | `X% moved on · N no further` | `N` is the count of leads whose furthest stage is that one — mostly live prospects sitting there, not losses. The minus sign read as attrition. |

## In scope

- `buildFunnel()` — a pure function turning the scoped lead list into counts.
- Cumulative count per funnel stage, and the drop to the next stage as both a
  number of leads and a percentage.
- A Lost count shown beside the funnel, excluded from every bar.
- The funnel rendered above the table on `/leads`, following the archived toggle.
- Sensible display when there is nothing to show (no leads, or all leads Lost).

## Out of scope, deliberately

| Thing | Why not | What happens instead |
|---|---|---|
| A stage-change event log | It is the fix for both known limitations above and it is a real feature: a schema, a write on every stage change, a backfill decision for existing leads, and retention rules for what is effectively patient-contact history. Bolting it on inside a display change would get it wrong. | The limitations are written down above and named as the upgrade path. The funnel is honest about being an estimate. |
| Date ranges / "this month" filters | Nobody asked, and without the event log the app cannot answer time-based questions anyway — it has no record of *when* a lead reached a stage, only when the document was last touched. | The funnel describes the pipeline as it stands right now. |
| Per-owner breakdown for admins ("Tom's funnel vs Priya's") | It is a filter feature, and spec 0001 already put the owner filter out of scope for the same reason. Adding it here would mean a filter UI that the table does not have, on the same page. | An admin sees one practice-wide funnel. The dev switcher already shows a single agent's funnel. |
| Clicking a bar to filter the table to that stage | Tempting and small, but it is a second interaction model on a page that currently has one, and it needs decisions about how it combines with the archived toggle and what the URL looks like. | Bars are display only. |
| Trends, targets, forecasts, conversion over time | Each needs history the app does not have, and a target needs someone to decide what good looks like for this practice. | Not shown. |
| A charting library | Five horizontal bars are `div`s with a width percentage. A dependency for this would be pure cost — bundle size, a theming surface, and an upgrade to track. | Plain markup and Tailwind, matching the existing stage colours. |
| A separate `/funnel` route | Explicitly not wanted: it belongs above the table. | One page, one query, one set of numbers. |
| Recomputing the funnel on the client | The count is the visible evidence that the permission scope is real. Anything computed client-side from data the client already holds proves nothing and can be tampered with. | Computed on the server from the scoped list. |

## Approach

| File | Change |
|---|---|
| `src/models/lead-enums.ts` | Add `FUNNEL_STAGES` — `STAGES` without `Lost` — so the funnel's shape has one definition and cannot drift from the stage list. |
| `src/lib/funnel.ts` | **New.** `buildFunnel(leads: LeadListItem[]): FunnelData`. Pure, no database, no `server-only` — it is a calculation, and keeping it pure is what makes it cheap to test exhaustively. |
| `src/app/leads/stage-styles.ts` | **New.** `STAGE_STYLES` moved out of `lead-row.tsx` (it was already there) plus `STAGE_BAR` solid fills, so a stage is the same colour in the table and in the funnel. |
| `src/app/leads/funnel.tsx` | **New.** Presentational Server Component taking `FunnelData`. Bars as `div`s with a width percentage, using the stage colours already defined for the table. |
| `src/app/leads/page.tsx` | Call `buildFunnel(leads)` and render `<Funnel />` above the table. |
| `src/lib/funnel.test.ts` | **New.** The arithmetic, exhaustively (see Test cases). |

### Where the numbers come from

`page.tsx` already holds `leads` — the result of `listLeads({ includeArchived })`,
which has `scopeFor(user)` merged into its filter. The funnel is derived from
**that same array**, on the server.

This is deliberate and it buys two things: there is no second query and no second
place for the permission rule to be got wrong, and the funnel and the table can
never disagree, because they are the same rows counted two ways. The archived
toggle is inherited for free.

> **Condition on this choice:** it holds only while the page fetches every lead
> the user can see. If pagination or a row limit is ever added, the funnel would
> silently start describing one page instead of the whole pipeline. At that
> point `buildFunnel` must be replaced by its own aggregation query carrying
> `scopeFor(user)`. This is to be marked in the code with a `TODO:` next to the
> call, not left to memory.

### The arithmetic

Given the scoped leads:

1. Drop every lead whose stage is `Lost`; count them into `lost`.
2. For each stage in `FUNNEL_STAGES`, `reached[i]` = the number of remaining
   leads whose stage is at index `i` **or later**.
3. `drop[i]` = `reached[i] - reached[i+1]`, and the conversion to the next
   stage is `reached[i+1] / reached[i]`.

`reached[0]` therefore equals every non-Lost lead in scope. Bar widths are
`reached[i] / reached[0]`.

## Edge cases

| Case | Expected behaviour |
|---|---|
| No leads at all in scope | Funnel renders with every count at zero and no percentages, or is replaced by the table's existing empty state. No division by zero, no `NaN`, no `Infinity`. |
| Every lead in scope is Lost | All bars zero, the Lost number carries the total. |
| A stage has zero reached, but a later one does not | Cannot happen by construction — cumulative counts are non-increasing. If it ever appears on screen, the arithmetic is broken, not the data. |
| Conversion where the previous stage is zero | Show "—", never 0%, `NaN` or a divide-by-zero. |
| Archived toggle flipped | Funnel and table change together; the funnel's total always equals the table's row count minus Lost. |
| Agent owns no leads | Zero funnel alongside the existing "You don't own any leads yet." |
| A lead is moved by a row action | The funnel re-renders with the table on the same revalidation — the count above must never lag the rows below. |

## Permissions

Unchanged from spec 0001, and deliberately so: the funnel introduces **no new
endpoint, no new query and no new access rule**. It is a second reading of rows
that `listLeads()` has already scoped with `scopeFor(user)`.

| Who | Sees |
|---|---|
| Admin | A funnel over every lead in the practice |
| Agent | A funnel over only the leads they own |

There is nothing to bypass here, because there is nothing new to call. The
existing proof (`npm run prove:permissions`) still covers the boundary that
matters.

## Subtasks

| # | Task | Estimate |
|---|---|---|
| 1 | `FUNNEL_STAGES` in `lead-enums.ts` | 10 min |
| 2 | `buildFunnel()` in `src/lib/funnel.ts` | 45 min |
| 3 | `src/lib/funnel.test.ts` | 45 min |
| 4 | `src/app/leads/funnel.tsx` — bars, Lost, drops | 1.5 h |
| 5 | Mount above the table in `page.tsx`, with the pagination `TODO:` | 20 min |
| 6 | Verification per `docs/VERIFICATION.md`, both roles in the browser | 45 min |

## Test cases

`buildFunnel` is pure, so these need no database and no server.

| # | Given | When | Then |
|---|---|---|---|
| 1 | Leads at New, Contacted, Won | `buildFunnel` | `reached` is non-increasing across the five stages |
| 2 | One lead at Won | `buildFunnel` | It is counted at all five stages, including New |
| 3 | Three Lost leads and two Active at New | `buildFunnel` | `lost` is 3; every bar counts only the 2 |
| 4 | Empty array | `buildFunnel` | All counts zero, `lost` zero, no `NaN` or `Infinity` anywhere in the result |
| 5 | All leads Lost | `buildFunnel` | Every bar zero, `lost` equals the total |
| 6 | Leads spread one per stage | `buildFunnel` | `drop[i]` is exactly 1 at each step, conversions match by hand |
| 7 | `reached[i]` is 0 | conversion to next stage | Reported as "no value", never 0% or a division result |
| 8 | The seeded data as an agent vs as an admin | `listLeads` then `buildFunnel` | The agent's totals are strictly smaller and contain none of the admin-only leads |

Case 4 is the one that breaks first in real use: an empty funnel is what a new
agent sees on their first day.

## Open questions

- [ ] **1. Drop displayed as a count, a percentage, or both?** Defaulting to
      both — "12 → 7 (58%)" — since a percentage alone hides how few leads it
      may be built on.
- [ ] **2. Should the bars be scaled to `reached[0]` or to the widest bar?**
      Defaulting to `reached[0]`, so the first bar is always full width and the
      shape is comparable between admin and agent.
- [ ] **3. Should Lost be a plain number, or also a percentage of all leads?**
      Defaulting to a number with the percentage beside it.
- [ ] **4. Does the funnel belong above or below the header controls** (Show
      archived / dev switcher)? Defaulting to directly under the header and
      above the table.

## Changelog

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Plan written | Claude |
| 2026-08-19 | **Plan approved**; all four open questions to be built as their stated defaults | shubham |
| 2026-08-19 | Built. Stage colours extracted to `stage-styles.ts` for reuse; `lead-row.tsx`'s local `Error` helper renamed `ActionError` (it shadowed the global) | Claude |
