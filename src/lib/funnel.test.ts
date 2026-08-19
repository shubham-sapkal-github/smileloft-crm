import { expect, test } from "vitest";
import { buildFunnel } from "./funnel";
import { FUNNEL_STAGES, STAGES } from "@/models/lead-enums";
import type { LeadListItem } from "./leads";

const lead = (stage: string, lostFromStage: string | null = null): LeadListItem =>
  ({
    id: Math.random().toString(16),
    name: "x",
    stage,
    lostFromStage,
    status: "Active",
  }) as LeadListItem;

const at = (stage: string, n: number) => Array.from({ length: n }, () => lead(stage));
/** Leads written off after reaching `stage`. */
const lostFrom = (stage: string, n: number) =>
  Array.from({ length: n }, () => lead("Lost", stage));
const reachedOf = (data: ReturnType<typeof buildFunnel>) => data.steps.map((s) => s.reached);

test("the funnel stages are the six stages without Lost", () => {
  expect(FUNNEL_STAGES).toEqual(STAGES.filter((s) => s !== "Lost"));
  expect(FUNNEL_STAGES).not.toContain("Lost");
});

test("reached is non-increasing across the funnel", () => {
  const data = buildFunnel([...at("New", 4), ...at("Contacted", 3), ...at("Won", 2)]);
  const reached = reachedOf(data);
  for (let i = 1; i < reached.length; i++) expect(reached[i]).toBeLessThanOrEqual(reached[i - 1]);
  expect(reached).toEqual([9, 5, 2, 2, 2]);
});

test("a lead at Won is counted at every earlier stage", () => {
  expect(reachedOf(buildFunnel(at("Won", 1)))).toEqual([1, 1, 1, 1, 1]);
});

// Changed deliberately: Lost leads used to vanish from every bar, which shrank
// the denominator and made losing a patient improve the conversion shown for
// the stage they were lost from. They now count as having enquired.
test("Lost leads count at the top of the funnel but are never a bar of their own", () => {
  const data = buildFunnel([...at("Lost", 3), ...at("New", 2)]);
  expect(data.lost).toBe(3);
  expect(reachedOf(data)).toEqual([5, 0, 0, 0, 0]);
  expect(data.total).toBe(5);
  expect(data.lostShare).toBeCloseTo(3 / 5);
});

// The regression this whole change exists to prevent.
test("losing a lead never improves the conversion of the stage it was lost from", () => {
  const before = buildFunnel([...at("Consult Booked", 2), ...at("Treatment Planned", 3)]);
  const after = buildFunnel([
    ...at("Consult Booked", 1),
    ...at("Treatment Planned", 3),
    ...lostFrom("Consult Booked", 1),
  ]);

  const consultBooked = 2;
  expect(after.steps[consultBooked].conversionToNext!).toBeLessThanOrEqual(
    before.steps[consultBooked].conversionToNext!,
  );
  // And the top of the funnel does not shrink when someone is lost.
  expect(after.steps[0].reached).toBe(before.steps[0].reached);
});

// Archiving means "treatment finished, filed away". Dropping those leads
// erased the practice's own wins from its funnel.
test("archived leads still count, including archived wins", () => {
  const active = buildFunnel([...at("New", 2), ...at("Won", 1)]);
  const archivedWin = buildFunnel([
    ...at("New", 2),
    ...at("Won", 1).map((lead) => ({ ...lead, status: "Archived" as const })),
  ]);
  expect(archivedWin.steps.at(-1)!.reached).toBe(1);
  expect(reachedOf(archivedWin)).toEqual(reachedOf(active));
});

test("an empty funnel is all zeros with no NaN or Infinity", () => {
  const data = buildFunnel([]);
  expect(reachedOf(data)).toEqual([0, 0, 0, 0, 0]);
  expect(data.lost).toBe(0);
  expect(data.total).toBe(0);
  expect(data.lostShare).toBeNull();
  for (const step of data.steps) {
    expect(step.conversionToNext).toBeNull();
    expect(Number.isFinite(step.reached)).toBe(true);
  }
  expect(JSON.stringify(data)).not.toMatch(/NaN|Infinity/);
});

// A lead lost before lostFromStage existed still counts as having enquired.
test("a Lost lead with no recorded stage falls back to the top of the funnel", () => {
  const data = buildFunnel(at("Lost", 4));
  expect(reachedOf(data)).toEqual([4, 0, 0, 0, 0]);
  expect(data.steps[0].conversionToNext).toBe(0);
  expect(data.lost).toBe(4);
  expect(data.lostShare).toBe(1);
});

test("one lead per stage gives a drop of exactly one at each step", () => {
  const data = buildFunnel(FUNNEL_STAGES.map((stage) => lead(stage)));
  expect(reachedOf(data)).toEqual([5, 4, 3, 2, 1]);
  expect(data.steps.map((s) => s.noFurther)).toEqual([1, 1, 1, 1, null]);
  expect(data.steps[0].conversionToNext).toBeCloseTo(4 / 5);
  expect(data.steps[3].conversionToNext).toBeCloseTo(1 / 2);
});

test("conversion is null, not zero, when nothing reached a stage", () => {
  const data = buildFunnel(at("New", 2));
  expect(data.steps[0].conversionToNext).toBe(0); // 2 -> 0 really is 0%
  expect(data.steps[1].conversionToNext).toBeNull(); // nothing reached Contacted
  expect(data.steps[2].conversionToNext).toBeNull();
});

test("the last step never reports a follow-on figure", () => {
  const last = buildFunnel(at("Won", 3)).steps.at(-1)!;
  expect(last.noFurther).toBeNull();
  expect(last.conversionToNext).toBeNull();
});

test("a Lost lead is credited with every stage it reached before it was lost", () => {
  const data = buildFunnel(lostFrom("Treatment Planned", 1));
  expect(reachedOf(data)).toEqual([1, 1, 1, 1, 0]);
  expect(data.lost).toBe(1);
});
