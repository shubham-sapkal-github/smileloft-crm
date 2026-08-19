import { FUNNEL_STAGES, type FunnelStage } from "@/models/lead-enums";
import type { LeadListItem } from "./leads";

export type FunnelStep = {
  stage: FunnelStage;
  /** Leads known to have reached this stage or a later one. Non-increasing. */
  reached: number;
  /**
   * Leads whose furthest known stage is this one — they have not gone further.
   * NOT the same as "dropped out": most are live prospects sitting at this
   * step. Null on the last step.
   */
  noFurther: number | null;
  /** Fraction 0–1 that went beyond this stage. Null on the last step, or if none reached it. */
  conversionToNext: number | null;
};

export type FunnelData = {
  steps: FunnelStep[];
  /** Leads written off. Counted at the top of the funnel, never as a bar. */
  lost: number;
  /** Everything in scope, whatever its stage or status. */
  total: number;
  lostShare: number | null;
};

/**
 * Counts are cumulative: a lead at Treatment Planned is counted at every
 * earlier stage too, so the bars only decrease and the figure between two of
 * them is a conversion rather than the gap between unrelated snapshots.
 *
 * Two rules keep the numbers honest, both learned the hard way:
 *
 * 1. **A lead's status is irrelevant here.** Archived leads still count. The
 *    practice archives patients whose treatment is *finished* — dropping them
 *    would erase the practice's wins, and the better it was at filing work
 *    away the worse its funnel would look.
 *
 * 2. **Lost leads still count for every stage they reached.** Removing them
 *    shrank the denominator without touching the numerator, so losing a
 *    patient *improved* the conversion shown for the stage they were lost
 *    from. `lostFromStage` records where they got to, so they are credited
 *    properly. Leads lost before that field existed fall back to `New` — they
 *    at least enquired.
 */
export function buildFunnel(leads: LeadListItem[]): FunnelData {
  const lost = leads.filter((lead) => lead.stage === "Lost").length;

  // The furthest stage a lead is known to have reached. For a lost lead that
  // is where it was lost from; failing that, New — it did at least enquire.
  const furthestReached = (lead: LeadListItem) => {
    const stage = lead.stage === "Lost" ? (lead.lostFromStage ?? "New") : lead.stage;
    return Math.max(FUNNEL_STAGES.indexOf(stage as FunnelStage), 0);
  };

  const reached = FUNNEL_STAGES.map(
    (_, index) => leads.filter((lead) => furthestReached(lead) >= index).length,
  );

  const steps = FUNNEL_STAGES.map((stage, index) => {
    const isLast = index === FUNNEL_STAGES.length - 1;
    const next = isLast ? null : reached[index + 1];
    return {
      stage,
      reached: reached[index],
      noFurther: next === null ? null : reached[index] - next,
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
