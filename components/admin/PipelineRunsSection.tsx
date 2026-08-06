"use client";

import { Loader2, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRunNowPipeline } from "@/lib/hooks/use-run-now-pipeline";
import type { ContentRun, RunStep } from "@/lib/supabase/types";
import { formatDisplayDateTime } from "@/lib/utils/format-date";

type PipelinePhase = "trend_research" | "ideation" | "gate1" | "gate2" | "publish";

type PhaseStatus = "pending" | "running" | "succeeded" | "failed";

type PipelineRunsSectionProps = {
  companySlug: string;
  runs: ContentRun[];
  stepsByRunId: Record<string, RunStep[]>;
};

const PHASE_LABELS: Record<PipelinePhase, string> = {
  trend_research: "Trend",
  ideation: "Ideation",
  gate1: "Gate 1",
  gate2: "Gate 2",
  publish: "Publish",
};

const PHASES: PipelinePhase[] = [
  "trend_research",
  "ideation",
  "gate1",
  "gate2",
  "publish",
];

function getRunStepStatus(
  steps: RunStep[],
  stepName: string
): PhaseStatus {
  const step = steps.find((row) => row.step_name === stepName);
  if (!step) return "pending";
  if (step.status === "running") return "running";
  if (step.status === "succeeded") return "succeeded";
  if (step.status === "failed") return "failed";
  return "pending";
}

function getGatePhaseStatus(
  runStatus: string,
  phase: "gate1" | "gate2" | "publish"
): PhaseStatus {
  if (runStatus === "failed") {
    return "failed";
  }

  if (phase === "gate1") {
    if (runStatus === "gate1_pending") return "running";
    if (["gate2_pending", "publishing", "complete"].includes(runStatus)) {
      return "succeeded";
    }
    return "pending";
  }

  if (phase === "gate2") {
    if (runStatus === "gate2_pending") return "running";
    if (runStatus === "complete") return "succeeded";
    if (["gate1_pending", "pending", "running"].includes(runStatus)) {
      return "pending";
    }
    return "pending";
  }

  if (runStatus === "complete") return "succeeded";
  if (runStatus === "publishing") return "running";
  return "pending";
}

function getPhaseStatus(
  run: ContentRun,
  steps: RunStep[],
  phase: PipelinePhase
): PhaseStatus {
  if (phase === "trend_research" || phase === "ideation") {
    return getRunStepStatus(steps, phase);
  }

  return getGatePhaseStatus(run.status, phase);
}

function phaseColorClass(status: PhaseStatus): string {
  switch (status) {
    case "running":
      return "bg-accent-violet shadow-[0_0_6px_rgba(204,43,43,0.5)]";
    case "succeeded":
      return "bg-accent-teal shadow-[0_0_6px_rgba(0,230,195,0.4)]";
    case "failed":
      return "bg-accent-pink shadow-[0_0_6px_rgba(255,77,141,0.4)]";
    default:
      return "bg-white/20";
  }
}

function runStatusBadgeClass(status: string): string {
  switch (status) {
    case "complete":
      return "status-pill status-pill-success";
    case "failed":
      return "status-pill status-pill-danger";
    case "gate1_pending":
    case "gate2_pending":
    case "running":
    case "publishing":
      return "status-pill status-pill-neutral";
    default:
      return "status-pill status-pill-neutral";
  }
}

function StepDots({
  run,
  steps,
}: {
  run: ContentRun;
  steps: RunStep[];
}) {
  return (
    <div className="flex items-center gap-2">
      {PHASES.map((phase) => {
        const status = getPhaseStatus(run, steps, phase);
        return (
          <div
            key={phase}
            className="flex flex-col items-center gap-1"
            title={`${PHASE_LABELS[phase]}: ${status}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${phaseColorClass(status)}`}
            />
            <span className="hidden text-[10px] text-text-muted xl:inline">
              {PHASE_LABELS[phase]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PipelineRunsSection({
  companySlug,
  runs,
  stepsByRunId,
}: PipelineRunsSectionProps) {
  const { running, runNow } = useRunNowPipeline(companySlug);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display font-semibold text-text-primary">Pipeline Runs</h3>
        <Button
          type="button"
          size="sm"
          disabled={running}
          onClick={() => void runNow()}
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run Now
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface-hover text-left text-text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Week Start</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Steps</th>
              <th className="px-5 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-text-muted"
                >
                  No pipeline runs yet.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="border-t border-border-subtle hover:bg-bg-surface-hover">
                  <td className="px-5 py-3">{run.week_start}</td>
                  <td className="px-5 py-3">
                    <Badge
                      className={`capitalize ${runStatusBadgeClass(run.status)}`}
                    >
                      {run.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <StepDots run={run} steps={stepsByRunId[run.id] ?? []} />
                  </td>
                  <td className="px-5 py-3 text-text-muted">
                    {formatDisplayDateTime(run.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
