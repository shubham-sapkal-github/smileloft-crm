import Link from "next/link";
import { toggleSidebar } from "./shell-actions";

const LIVE = [
  { label: "Leads", href: "/leads" },
  { label: "Funnel", href: "/leads#funnel" },
];

// The things a dental CRM would have. Shown as deliberately unbuilt rather than
// hidden: an empty page implies it is coming, a dimmed item states it is not
// here. Never <a href> — no dead links, no 404s, nothing to tab into.
const NOT_BUILT = [
  "Patients",
  "Appointments",
  "Treatments",
  "Invoices",
  "Reports",
  "Settings",
  "Users & Roles",
];

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <nav
      aria-label="Sections"
      className={`h-full shrink-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="flex h-full flex-col gap-1 p-2">
        <form action={toggleSidebar} className="mb-2 flex justify-end">
          <button
            type="submit"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d={collapsed ? "M7 4l6 6-6 6V4z" : "M13 4L7 10l6 6V4z"} />
            </svg>
          </button>
        </form>

        {LIVE.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className="truncate rounded-md px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {collapsed ? item.label.charAt(0) : item.label}
          </Link>
        ))}

        <p
          className={`mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 ${
            collapsed ? "sr-only" : ""
          }`}
        >
          Not built
        </p>

        {NOT_BUILT.map((label) => (
          <span
            key={label}
            aria-disabled="true"
            title={`${label} — not built`}
            className="flex cursor-not-allowed items-center justify-between truncate rounded-md px-3 py-2 text-sm text-zinc-400 select-none dark:text-zinc-600"
          >
            {collapsed ? label.charAt(0) : label}
            {!collapsed && (
              <span className="ml-2 shrink-0 rounded border border-zinc-200 px-1 text-[9px] uppercase dark:border-zinc-700">
                soon
              </span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}