import type { Stage } from "@/models/lead-enums";

// Shared by the table rows and the funnel bars, so a stage is the same colour
// wherever it appears on the page.
export const STAGE_STYLES: Record<Stage, string> = {
  New: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Contacted: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "Consult Booked": "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  "Treatment Planned": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  Won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Lost: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

// Solid fills for the funnel bars; the pill styles above are too pale to read
// as a bar.
export const STAGE_BAR: Record<string, string> = {
  New: "bg-zinc-400 dark:bg-zinc-600",
  Contacted: "bg-sky-400 dark:bg-sky-700",
  "Consult Booked": "bg-violet-400 dark:bg-violet-700",
  "Treatment Planned": "bg-amber-400 dark:bg-amber-600",
  Won: "bg-emerald-500 dark:bg-emerald-600",
};
