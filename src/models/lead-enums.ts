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
