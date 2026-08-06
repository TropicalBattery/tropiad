import type { LucideIcon } from "lucide-react";
import {
  CheckSquare,
  Lightbulb,
  RefreshCw,
  Send,
  Wand2,
} from "lucide-react";

import type { ContentRun, RunStep } from "@/lib/supabase/types";

export type PipelineStageKey =
  | "trend_research"
  | "concept_generation"
  | "gate1"
  | "content_production"
  | "gate2"
  | "publishing";

export type PipelineStageState = "complete" | "active" | "idle" | "failed";

export type PipelineStageDefinition = {
  key: PipelineStageKey;
  label: string;
  icon: LucideIcon;
};

export const PIPELINE_STAGES: readonly PipelineStageDefinition[] = [
  { key: "trend_research", label: "Trend Research", icon: RefreshCw },
  { key: "concept_generation", label: "Concept Generation", icon: Lightbulb },
  { key: "gate1", label: "Gate 1 Approval", icon: CheckSquare },
  { key: "content_production", label: "Content Production", icon: Wand2 },
  { key: "gate2", label: "Gate 2 Approval", icon: CheckSquare },
  { key: "publishing", label: "Publishing", icon: Send },
] as const;

const STEP_NAME_TO_STAGE: Record<string, PipelineStageKey> = {
  trend_research: "trend_research",
  ideation: "concept_generation",
  gate1_review: "gate1",
  caption_generation: "content_production",
  visual_production: "content_production",
  gate2_review: "gate2",
  publishing: "publishing",
};

export function mapStepNameToStage(stepName: string): PipelineStageKey | null {
  return STEP_NAME_TO_STAGE[stepName] ?? null;
}

/**
 * Deterministic current-stage index from run.status (+ light step heuristics
 * for pending / gate1 production). Index 6 means all stages complete.
 */
export function getActiveStageIndexFromRun(
  status: string,
  steps: RunStep[]
): number {
  if (status === "complete") {
    return 6;
  }

  if (status === "failed") {
    const failedIndex = PIPELINE_STAGES.findIndex((stage) =>
      steps.some(
        (step) =>
          mapStepNameToStage(step.step_name) === stage.key &&
          step.status === "failed"
      )
    );
    return failedIndex >= 0 ? failedIndex : 0;
  }

  if (status === "publishing") {
    return 5;
  }

  if (status === "gate2_pending") {
    return 4;
  }

  if (status === "gate1_pending") {
    const productionRunning = steps.some(
      (step) =>
        mapStepNameToStage(step.step_name) === "content_production" &&
        step.status === "running"
    );
    return productionRunning ? 3 : 2;
  }

  if (status === "pending" || status === "running") {
    const ideation = steps.find((step) => step.step_name === "ideation");
    if (
      ideation?.status === "running" ||
      ideation?.status === "succeeded"
    ) {
      return 1;
    }

    const trend = steps.find((step) => step.step_name === "trend_research");
    if (trend?.status === "succeeded") {
      return 1;
    }

    return 0;
  }

  return 0;
}

export type DerivedPipelineStage = {
  key: PipelineStageKey;
  label: string;
  icon: LucideIcon;
  state: PipelineStageState;
  steps: RunStep[];
};

export function derivePipelineStageStates(
  run: Pick<ContentRun, "status">,
  steps: RunStep[]
): DerivedPipelineStage[] {
  const activeIndex = getActiveStageIndexFromRun(run.status, steps);

  return PIPELINE_STAGES.map((stage, index) => {
    const stageSteps = steps.filter(
      (step) => mapStepNameToStage(step.step_name) === stage.key
    );
    const hasFailed = stageSteps.some((step) => step.status === "failed");

    let state: PipelineStageState = "idle";

    if (hasFailed || (run.status === "failed" && activeIndex === index)) {
      state = "failed";
    } else if (run.status === "complete" || activeIndex > index) {
      state = "complete";
    } else if (activeIndex === index) {
      state = "active";
    }

    return {
      key: stage.key,
      label: stage.label,
      icon: stage.icon,
      state,
      steps: stageSteps,
    };
  });
}

export function countCompletedStages(
  stages: DerivedPipelineStage[]
): number {
  return stages.filter((stage) => stage.state === "complete").length;
}

export function formatStepDurationSeconds(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}

export function getStepDurationSeconds(step: RunStep): number | null {
  if (!step.completed_at || !step.started_at) {
    return null;
  }

  return (
    (new Date(step.completed_at).getTime() -
      new Date(step.started_at).getTime()) /
    1000
  );
}

export type ContentProductionSummary = {
  postsProduced: number;
  inProgressCount: number;
  totalDurationSeconds: number | null;
  detail: string;
};

export function summarizeContentProduction(
  steps: RunStep[]
): ContentProductionSummary {
  const productionSteps = steps.filter(
    (step) => mapStepNameToStage(step.step_name) === "content_production"
  );
  const postsProduced = productionSteps.filter(
    (step) =>
      step.step_name === "visual_production" && step.status === "succeeded"
  ).length;
  const inProgressCount = productionSteps.filter(
    (step) => step.status === "running"
  ).length;

  let totalDurationSeconds: number | null = null;
  for (const step of productionSteps) {
    if (step.status !== "succeeded") {
      continue;
    }
    const seconds = getStepDurationSeconds(step);
    if (seconds == null) {
      continue;
    }
    totalDurationSeconds = (totalDurationSeconds ?? 0) + seconds;
  }

  const parts: string[] = [];
  if (postsProduced > 0) {
    parts.push(
      `${postsProduced} post${postsProduced === 1 ? "" : "s"} produced`
    );
  }
  if (inProgressCount > 0) {
    parts.push(
      `${inProgressCount} in progress`
    );
  }
  if (totalDurationSeconds != null && totalDurationSeconds > 0) {
    parts.push(formatStepDurationSeconds(totalDurationSeconds));
  }

  return {
    postsProduced,
    inProgressCount,
    totalDurationSeconds,
    detail: parts.join(" · "),
  };
}

export function getRunLevelStageDetail(
  stage: DerivedPipelineStage
): string {
  if (stage.state === "idle") {
    return "";
  }

  if (stage.key === "content_production") {
    if (stage.state === "active" && stage.steps.length === 0) {
      return "In progress...";
    }
    const summary = summarizeContentProduction(stage.steps);
    if (stage.state === "active" && summary.inProgressCount === 0) {
      return summary.detail
        ? `${summary.detail} · In progress...`
        : "In progress...";
    }
    if (stage.state === "failed") {
      return summary.detail || "Failed";
    }
    return summary.detail;
  }

  if (stage.state === "active") {
    return "In progress...";
  }

  if (stage.state === "failed") {
    const failed = stage.steps.find((step) => step.status === "failed");
    return failed?.error_message
      ? failed.error_message.slice(0, 48)
      : "Failed";
  }

  if (stage.state === "complete") {
    const succeeded = stage.steps.filter((step) => step.status === "succeeded");
    const withDuration = succeeded
      .map((step) => getStepDurationSeconds(step))
      .filter((value): value is number => value != null);
    if (withDuration.length === 0) {
      return "";
    }
    const total = withDuration.reduce((sum, value) => sum + value, 0);
    return formatStepDurationSeconds(total);
  }

  return "";
}
