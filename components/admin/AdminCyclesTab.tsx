import { format } from "date-fns";

import type { ContentRun, RunStep } from "@/lib/supabase/types";

export type ContentRunWithSteps = ContentRun & {
  run_steps: RunStep[];
  companies?: { name: string; slug: string } | null;
};

type AdminCyclesTabProps = {
  contentRuns: ContentRunWithSteps[];
};

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "complete":
      return "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
    case "gate1_pending":
      return "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
    case "gate2_pending":
      return "bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800";
    case "failed":
      return "bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800";
    case "publishing":
      return "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800";
    default:
      return "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Completed";
    case "gate1_pending":
      return "Awaiting review";
    case "gate2_pending":
      return "Ready to publish";
    case "failed":
      return "Failed";
    case "publishing":
      return "Publishing";
    default:
      return status.replace(/_/g, " ");
  }
}

function getStepDotClass(status: string): string {
  if (status === "succeeded") {
    return "bg-emerald-500 dark:bg-emerald-400";
  }
  if (status === "failed") {
    return "bg-red-500 dark:bg-red-400";
  }
  if (status === "running") {
    return "bg-amber-500 dark:bg-amber-400 animate-pulse";
  }
  return "bg-slate-300 dark:bg-slate-600";
}

function getStepStatusClass(status: string): string {
  if (status === "succeeded") {
    return "text-emerald-700 dark:text-emerald-400";
  }
  if (status === "failed") {
    return "text-red-700 dark:text-rose-400";
  }
  return "text-[#9ca3af] dark:text-slate-500";
}

export function AdminCyclesTab({ contentRuns }: AdminCyclesTabProps) {
  if (contentRuns.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-10 text-center text-sm text-[#9ca3af] dark:text-slate-500">
        No content runs yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {contentRuns.map((run) => {
        const steps = [...(run.run_steps ?? [])].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        return (
          <div
            key={run.id}
            className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {run.companies?.name ? (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-sky-50 dark:bg-cyan-900/40 text-sky-700 dark:text-cyan-300 border border-sky-200 dark:border-cyan-800">
                    {run.companies.name}
                  </span>
                ) : null}
                <span className="text-sm font-medium text-[#111111] dark:text-white">
                  Week of {format(new Date(run.week_start), "MMM d, yyyy")}
                </span>
                <span className="text-xs text-[#9ca3af] dark:text-slate-500">
                  {run.id.slice(0, 8)}
                </span>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBadgeClass(run.status)}`}
              >
                {getStatusLabel(run.status)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {steps.length === 0 ? (
                <p className="text-xs text-slate-600">No steps recorded.</p>
              ) : (
                steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 text-xs">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${getStepDotClass(step.status)}`}
                    />
                    <span className="w-32 flex-shrink-0 text-[#6b7280] dark:text-slate-400">
                      {step.step_name}
                    </span>
                    <span className={getStepStatusClass(step.status)}>
                      {step.status}
                    </span>
                    {step.error_message ? (
                      <span className="max-w-xs truncate text-red-700 dark:text-rose-400">
                        {step.error_message}
                      </span>
                    ) : null}
                    {step.cost_usd ? (
                      <span className="ml-auto text-slate-600">
                        ${step.cost_usd.toFixed(4)}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {run.completed_at ? (
              <p className="mt-3 text-xs text-slate-600">
                Completed{" "}
                {format(new Date(run.completed_at), "MMM d, yyyy h:mm a")}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
