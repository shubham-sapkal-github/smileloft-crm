import type { Stage } from "@/models/lead-enums";

// Shared by the table rows and the funnel bars, so a stage is the same colour
// wherever it appears on the page.
// Labels, not decoration: a quiet tint with a matching border and readable
// weight, rather than a saturated badge competing with the row content.
export const STAGE_STYLES: Record<Stage, string> = {
  New: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  Contacted: "bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
  "Consult Booked": "bg-violet-50 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
  "Treatment Planned": "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  Won: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  Lost: "bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900",
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
