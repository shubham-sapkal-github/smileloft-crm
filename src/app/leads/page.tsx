import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { buildFunnel } from "@/lib/funnel";
import DevUserSwitcher from "./dev-user-switcher";
import LeadRow from "./lead-row";
import Funnel from "./funnel";

const CELL = "px-4 py-3 align-top";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const includeArchived = (await searchParams).archived === "1";
  const user = await getCurrentUser();
  const leads = await listLeads({ includeArchived });
  // TODO: the funnel counts the rows this page fetched. Correct only while the
  // page fetches every lead in scope — if pagination or a row limit is ever
  // added, this must become its own aggregation query carrying scopeFor(user),
  // or the funnel will silently describe one page instead of the pipeline.
  const funnel = buildFunnel(leads);

  return (
    <div className="min-h-full w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Acting as{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {user.name}
              </span>{" "}
              ({user.role}) — seeing{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {leads.length} {leads.length === 1 ? "lead" : "leads"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={includeArchived ? "/leads" : "/leads?archived=1"}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {includeArchived ? "Hide archived" : "Show archived"}
            </Link>
            <DevUserSwitcher />
          </div>
        </header>

        <Funnel data={funnel} />

        {leads.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium">
              {user.role === "agent"
                ? "You don't own any leads yet."
                : "There are no leads to show."}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {user.role === "agent"
                ? "Leads assigned to you will appear here."
                : "Run npm run seed to load demo data."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-4xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className={CELL}>Name</th>
                  <th className={CELL}>Contact</th>
                  <th className={CELL}>Location</th>
                  <th className={CELL}>Treatment interest</th>
                  <th className={CELL}>Stage</th>
                  <th className={CELL}>Status</th>
                  <th className={CELL}>Owner</th>
                  <th className={CELL}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} canAssign={user.role === "admin"} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
