// Deliberately free of `server-only`: these constants are the single source of
// truth for BOTH the server-side validation and the client-side dropdowns, so
// the row controls (a Client Component) must be able to import them. The model
// in ./Lead.ts is server-only and cannot be imported from the client.
export const STAGES = [
  "New",
  "Contacted",
  "Consult Booked",
  "Treatment Planned",
  "Won",
  "Lost",
] as const;

export const STATUSES = ["Active", "Archived"] as const;

export type Stage = (typeof STAGES)[number];
export type Status = (typeof STATUSES)[number];

// The funnel is the path from enquiry to treatment. Lost is where people fall
// out of it, not a step along it. Derived rather than retyped so it cannot
// drift from STAGES.
export const FUNNEL_STAGES = STAGES.filter(
  (stage): stage is Exclude<Stage, "Lost"> => stage !== "Lost",
);

export type FunnelStage = (typeof FUNNEL_STAGES)[number];
