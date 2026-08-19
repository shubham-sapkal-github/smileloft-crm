import { FUNNEL_STAGES, type FunnelStage } from "@/models/lead-enums";
import type { LeadListItem } from "./leads";

export type FunnelStep = {
  stage: FunnelStage;
  /** Leads at this stage or any later one. Non-increasing across the funnel. */
  reached: number;
  /** Leads that did not carry on to the next stage. Null on the last step. */
  dropToNext: number | null;
  /** Fraction 0–1 that carried on. Null on the last step, or if none reached. */
  conversionToNext: number | null;
};

export type FunnelData = {
  steps: FunnelStep[];
  /** Leads no longer on the path. Never counted in any step. */
  lost: number;
  /** Everything in scope, funnel and lost together. */
  total: number;
  /** Lost as a fraction of everything in scope. Null when there is nothing. */
  lostShare: number | null;
};

/**
 * Counts are cumulative: a lead at Treatment Planned is counted at every
 * earlier stage too, so the bars only decrease and the drop between two of
 * them is a conversion rather than the gap between unrelated snapshots.
 *
 * This INFERS that a lead passed through the earlier stages. The data does not
 * record it — see "Known limitations" in docs/specs/0002-funnel-view.md. The
 * fix is a log of stage changes, which does not exist yet.
 */
export function buildFunnel(leads: LeadListItem[]): FunnelData {
  const onPath = leads.filter((lead) => lead.stage !== "Lost");
  const lost = leads.length - onPath.length;

  const reached = FUNNEL_STAGES.map(
    (_, index) =>
      onPath.filter((lead) => FUNNEL_STAGES.indexOf(lead.stage as FunnelStage) >= index)
        .length,
  );

  const steps = FUNNEL_STAGES.map((stage, index) => {
    const isLast = index === FUNNEL_STAGES.length - 1;
    const next = isLast ? null : reached[index + 1];
    return {
      stage,
      reached: reached[index],
      dropToNext: next === null ? null : reached[index] - next,
      // Nothing reached this stage means there is no conversion to report —
      // not zero, which would read as "everybody dropped out".
      conversionToNext: next === null || reached[index] === 0 ? null : next / reached[index],
    };
  });

  return {
    steps,
    lost,
    total: leads.length,
    lostShare: leads.length === 0 ? null : lost / leads.length,
  };
}
