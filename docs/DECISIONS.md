# Decisions

One row per decision: what, why, and what it costs us. Newest first.

| Date | Decision | Why | Cost we accepted |
|---|---|---|---|
| 2026-08-19 | Funnel counts every lead in scope regardless of status, and credits Lost leads for the stages they reached (new `lostFromStage` field) | The old funnel dropped Lost and archived leads from the bars, which meant losing a patient *improved* the conversion of the stage they were lost from (measured 60% → 75%), and archiving completed treatment erased the practice's wins (Won read 0 while two patients had converted). | A field on the lead written by `setStage`. It is not a history: only the most recent loss is recorded, and leads lost before it existed count at `New` only. The funnel now deliberately disagrees with a filtered table, so the page states its scope under the heading. |
| 2026-08-19 | Reversed spec 0001's "no create form": leads can now be added from the UI (spec 0003) | Seed-only data made the app impossible to use for its actual job — recording an enquiry. The original reason for excluding it (a create form is a second feature with its own validation rules) was right, so it got its own spec rather than being bolted onto the table. | A new POST-able endpoint, and mass assignment as a live risk: owner, stage and status must be server-derived and never read from the form. Guarded by a test that is verified by deletion. |
| 2026-08-19 | Reversed spec 0001's "no archive row action": archive/unarchive added (spec 0003) | `status` was a column the app displayed with no way to change, so archived leads existed only because the seed made them. A create form then made mistakes easy to produce with no undo, and archiving is the correct undo for a CRM — a practice files a patient record away, it does not delete it. | A fourth row action to maintain. Kept cheap by giving it the same shape and permission rule as `setStage` rather than a new concept. |
| 2026-08-19 | `npm run seed` now deletes leads it did not create | A hand-added lead survived a re-seed, so there was no way to reset to a known state before a demo. | The script is destructive. Guarded by refusing to run against any `MONGODB_URI` host that is not localhost. |

## Deliberately not built

The ones that get forgotten and then re-argued three months later. Write them
down here the moment the decision is made.

| Thing | Why not | When to revisit |
|---|---|---|
| | | |
