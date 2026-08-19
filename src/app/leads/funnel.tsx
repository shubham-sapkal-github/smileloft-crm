import type { FunnelData } from "@/lib/funnel";
import { STAGE_BAR } from "./stage-styles";

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

export default function Funnel({ data }: { data: FunnelData }) {
  const widest = data.steps[0]?.reached ?? 0;

  return (
    <section
      id="funnel"
      aria-label="Pipeline funnel"
      className="mb-6 grid gap-6 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-[1fr_auto] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Pipeline</h2>
        {/* Said out loud, because the table above can be filtered and this is
            not — a funnel that changed with a view filter would not be one. */}
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-500">
          Every lead, archived included. A lead counts at each stage it reached.
        </p>

        {widest === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No leads on the pipeline.
          </p>
        ) : (
          <ol className="space-y-1">
            {data.steps.map((step, index) => {
              const next = data.steps[index + 1]?.stage;
              return (
                <li key={step.stage}>
                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                      {step.stage}
                    </span>
                    <div className="h-6 min-w-0 flex-1 rounded bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-6 rounded ${STAGE_BAR[step.stage]}`}
                        // Scaled to the first bar, so the shape is comparable
                        // between an admin's funnel and an agent's.
                        style={{ width: `${(step.reached / widest) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
                      {step.reached}
                    </span>
                  </div>

                  {step.noFurther !== null && next && (
                    <div className="flex items-center gap-3 py-0.5">
                      <span className="w-40 shrink-0" />
                      {/* Names both stages — a bare "89% moved on" between two
                          rows doesn't say which row it belongs to. "no
                          further" rather than "dropped": most of these are
                          live prospects sitting at this step, not losses. */}
                      <span className="text-xs text-zinc-500 dark:text-zinc-500">
                        {step.conversionToNext === null
                          ? "—"
                          : `${percent(step.conversionToNext)} of ${step.stage} moved on to ${next}`}
                        {step.noFurther > 0 && (
                          <> · {step.noFurther} still on {step.stage}</>
                        )}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Lost is not a step on the path — it is where people leave it. */}
      <div className="flex flex-col justify-start rounded-md bg-rose-50 px-5 py-4 text-center md:w-44 dark:bg-rose-950/30">
        <span className="text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-400">
          Lost
        </span>
        <span className="mt-1 text-2xl font-semibold tabular-nums text-rose-800 dark:text-rose-300">
          {data.lost}
        </span>
        <span className="mt-1 text-xs text-rose-700/80 dark:text-rose-400/80">
          {data.lostShare === null
            ? "no leads yet"
            : `${percent(data.lostShare)} of all leads`}
        </span>
      </div>
    </section>
  );
}
