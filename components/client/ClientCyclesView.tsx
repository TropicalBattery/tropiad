"use client";

import { format } from "date-fns";
import { AlertCircle, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildRunProductionBreakdown,
  conceptTitle,
  resolveProductionStatus,
} from "@/lib/approvals/production-status";
import type { ContentRun, Post, RunStep } from "@/lib/supabase/types";
import {
  PIPELINE_STAGES,
  countCompletedStages,
  derivePipelineStageStates,
  getRunLevelStageDetail,
  type PipelineStageState,
} from "@/lib/utils/pipeline-stages";
import { cn } from "@/lib/utils";

export type ContentRunWithSteps = ContentRun & {
  run_steps: RunStep[];
};

type ClientCyclesViewProps = {
  runs: ContentRunWithSteps[];
  posts: Post[];
  companySlug: string;
};

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "complete":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "gate1_pending":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "gate2_pending":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    case "failed":
      return "bg-red-50 text-red-700 border border-red-200";
    case "publishing":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "pending":
    case "running":
      return "bg-slate-50 text-slate-600 border border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border border-slate-200";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Completed";
    case "gate1_pending":
      return "Awaiting your review";
    case "gate2_pending":
      return "Ready to publish";
    case "failed":
      return "Failed";
    case "publishing":
      return "Publishing";
    case "pending":
      return "Pending";
    case "running":
      return "In progress";
    default:
      return status.replace(/_/g, " ");
  }
}

function StageCircle({ state }: { state: PipelineStageState }) {
  return (
    <div
      className={cn(
        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
        state === "complete" && "border-[#CC2B2B] bg-[#CC2B2B] text-white",
        state === "active" && "border-[#CC2B2B] bg-[#CC2B2B]/20",
        state === "failed" && "border-[#CC2B2B] bg-[#fdf2f2] text-[#CC2B2B]",
        state === "idle" && "border-[#E5E7EB] bg-[#f8fafc] text-[#9ca3af]"
      )}
    >
      {state === "complete" ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : state === "failed" ? (
        <AlertCircle className="h-4 w-4" aria-hidden />
      ) : state === "active" ? (
        <span
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#CC2B2B]"
          aria-hidden
        />
      ) : (
        <span className="h-2 w-2 rounded-full bg-[#D1D5DB]" aria-hidden />
      )}
    </div>
  );
}

function ProductionPostRow({ post }: { post: Post }) {
  const status = resolveProductionStatus(post);
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#111111]">
          {conceptTitle(post, 56)}
        </p>
        <p className="text-xs text-[#6B7280]">
          {post.platform} · {post.content_type} · {status.label}
        </p>
      </div>
      <p className="shrink-0 text-xs text-[#9ca3af]">
        Updated {format(new Date(post.updated_at), "MMM d, h:mm a")}
      </p>
    </div>
  );
}

export function ClientCyclesView({
  runs,
  posts,
  companySlug,
}: ClientCyclesViewProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const postsByRunId = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (!post.run_id) continue;
      const list = map.get(post.run_id) ?? [];
      list.push(post);
      map.set(post.run_id, list);
    }
    return map;
  }, [posts]);

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center">
        <p className="text-sm text-[#6b7280]">
          No content cycles yet. Your first weekly run will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#9ca3af]">Showing your last 12 weeks</p>

      <div className="flex flex-col gap-3">
        {runs.map((run) => {
          const stages = derivePipelineStageStates(run, run.run_steps ?? []);
          const completedCount = countCompletedStages(stages);
          const runPosts = postsByRunId.get(run.id) ?? [];
          const breakdown = buildRunProductionBreakdown(runPosts);
          const isExpanded = expandedRunId === run.id;

          return (
            <div
              key={run.id}
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111111]">
                    Week of {format(new Date(run.week_start), "MMM d, yyyy")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9ca3af]">
                    {completedCount} of {PIPELINE_STAGES.length} stages complete
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    getStatusBadgeClass(run.status)
                  )}
                >
                  {getStatusLabel(run.status)}
                </span>
              </div>

              <div className="space-y-2.5">
                {stages.map((stage) => {
                  const Icon = stage.icon;
                  const isProduction = stage.key === "content_production";
                  const detail = isProduction
                    ? breakdown.summary
                    : getRunLevelStageDetail(stage);
                  const isEmphasized =
                    stage.state === "active" || stage.state === "failed";

                  return (
                    <div key={stage.key} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <StageCircle state={stage.state} />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                stage.state === "complete" ||
                                  stage.state === "active"
                                  ? "text-[#CC2B2B]"
                                  : stage.state === "failed"
                                    ? "text-[#CC2B2B]"
                                    : "text-[#9ca3af]"
                              )}
                              aria-hidden
                            />
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isEmphasized
                                  ? "text-[#111111]"
                                  : stage.state === "complete"
                                    ? "text-[#374151]"
                                    : "text-[#9ca3af]"
                              )}
                            >
                              {stage.label}
                            </p>
                            {detail ? (
                              <span className="ml-auto shrink-0 text-xs text-[#9ca3af]">
                                {detail}
                              </span>
                            ) : null}
                            {isProduction ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#CC2B2B]"
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setExpandedRunId(
                                    isExpanded ? null : run.id
                                  )
                                }
                              >
                                Details
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 transition-transform",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {isProduction && isExpanded ? (
                        <div className="ml-10 space-y-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
                          {(
                            [
                              ["Generating", breakdown.generating],
                              ["Completed", breakdown.completed],
                              ["Failed", breakdown.failed],
                              [
                                "Waiting for connection",
                                breakdown.awaitingConnection,
                              ],
                            ] as const
                          ).map(([label, groupPosts]) =>
                            groupPosts.length > 0 ? (
                              <div key={label} className="space-y-1.5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                                  {label} ({groupPosts.length})
                                </p>
                                {groupPosts.map((post) => (
                                  <ProductionPostRow
                                    key={post.id}
                                    post={post}
                                  />
                                ))}
                              </div>
                            ) : null
                          )}
                          <Link
                            href={`/dashboard/${companySlug}/approve?run=${run.id}&tab=production`}
                            className="inline-flex text-sm font-medium text-[#CC2B2B] hover:underline"
                          >
                            View in Approval Queue
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {run.completed_at ? (
                <p className="mt-3 border-t border-[#E5E7EB] pt-3 text-xs text-[#9ca3af]">
                  Completed{" "}
                  {format(new Date(run.completed_at), "MMM d, yyyy h:mm a")}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
