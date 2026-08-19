import { expect, test } from "vitest";
import { buildFunnel } from "./funnel";
import { FUNNEL_STAGES, STAGES } from "@/models/lead-enums";
import type { LeadListItem } from "./leads";

const lead = (stage: string): LeadListItem =>
  ({ id: Math.random().toString(16), name: "x", stage, status: "Active" }) as LeadListItem;

const at = (stage: string, n: number) => Array.from({ length: n }, () => lead(stage));
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

test("Lost leads are counted separately and appear in no bar", () => {
  const data = buildFunnel([...at("Lost", 3), ...at("New", 2)]);
  expect(data.lost).toBe(3);
  expect(reachedOf(data)).toEqual([2, 0, 0, 0, 0]);
  expect(data.total).toBe(5);
  expect(data.lostShare).toBeCloseTo(3 / 5);
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

test("when every lead is Lost, every bar is zero", () => {
  const data = buildFunnel(at("Lost", 4));
  expect(reachedOf(data)).toEqual([0, 0, 0, 0, 0]);
  expect(data.lost).toBe(4);
  expect(data.lostShare).toBe(1);
});

test("one lead per stage gives a drop of exactly one at each step", () => {
  const data = buildFunnel(FUNNEL_STAGES.map((stage) => lead(stage)));
  expect(reachedOf(data)).toEqual([5, 4, 3, 2, 1]);
  expect(data.steps.map((s) => s.dropToNext)).toEqual([1, 1, 1, 1, null]);
  expect(data.steps[0].conversionToNext).toBeCloseTo(4 / 5);
  expect(data.steps[3].conversionToNext).toBeCloseTo(1 / 2);
});

test("conversion is null, not zero, when nothing reached a stage", () => {
  const data = buildFunnel(at("New", 2));
  expect(data.steps[0].conversionToNext).toBe(0); // 2 -> 0 really is 0%
  expect(data.steps[1].conversionToNext).toBeNull(); // nothing reached Contacted
  expect(data.steps[2].conversionToNext).toBeNull();
});

test("the last step never reports a drop or a conversion", () => {
  const last = buildFunnel(at("Won", 3)).steps.at(-1)!;
  expect(last.dropToNext).toBeNull();
  expect(last.conversionToNext).toBeNull();
});
