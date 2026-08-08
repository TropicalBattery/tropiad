// Server-only: do not import this module into client components.

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, RunStep } from "@/lib/supabase/types";

/** Generous enough that an in-progress Claude/Flux/Veo call is never reaped. */
export const STEP_RUNNING_TIMEOUT_MS = 10 * 60 * 1000;

/** After this many failed/reaped attempts, fail the post instead of retrying. */
export const STEP_MAX_ATTEMPTS = 3;

const REAP_ERROR_MESSAGE =
  "Reaped: step exceeded running timeout (likely function timeout)";

const PRODUCTION_STEP_NAMES = ["caption_generation", "visual_production"] as const;

export type ReapedRunStep = {
  id: string;
  run_id: string;
  step_name: string;
  attempt_count: number;
};

export type ReapOrphanedStepsResult = {
  reaped: ReapedRunStep[];
  postsFailed: string[];
  postsReset: string[];
};

function truncateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.slice(0, 500);
}

export async function getStepStatus(
  runId: string,
  stepName: string
): Promise<RunStep | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("run_steps")
    .select("*")
    .eq("run_id", runId)
    .eq("step_name", stepName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch run step: ${error.message}`);
  }

  return data;
}

export async function startStep(
  runId: string,
  stepName: string,
  inputJson?: Record<string, unknown>
): Promise<string> {
  const admin = createAdminClient();
  const existing = await getStepStatus(runId, stepName);
  const now = new Date().toISOString();

  if (existing?.status === "failed") {
    const { data, error } = await admin
      .from("run_steps")
      .update({
        status: "running",
        attempt_count: (existing.attempt_count ?? 0) + 1,
        started_at: now,
        input_json: (inputJson ?? existing.input_json) as Json | null,
        error_message: null,
        completed_at: null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        error?.message ?? "Failed to restart failed run step."
      );
    }

    return data.id;
  }

  const { data, error } = await admin
    .from("run_steps")
    .insert({
      run_id: runId,
      step_name: stepName,
      status: "running",
      attempt_count: 1,
      started_at: now,
      input_json: (inputJson ?? null) as Json | null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to start run step.");
  }

  return data.id;
}

export async function completeStep(
  stepId: string,
  outputJson?: Record<string, unknown>,
  costUsd?: number
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("run_steps")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      output_json: (outputJson ?? null) as Json | null,
      cost_usd: costUsd ?? 0,
    })
    .eq("id", stepId);

  if (error) {
    throw new Error(`Failed to complete run step: ${error.message}`);
  }
}

export async function failStep(stepId: string, error: unknown): Promise<void> {
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("run_steps")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: truncateError(error),
    })
    .eq("id", stepId);

  if (updateError) {
    throw new Error(`Failed to mark run step failed: ${updateError.message}`);
  }
}

function resetStageForStep(stepName: string): "ideation" | "visual" {
  return stepName === "caption_generation" ? "ideation" : "visual";
}

/**
 * Mark orphaned running steps failed so startStep can retry them.
 * Production steps also reset the related producing post (or fail it after
 * STEP_MAX_ATTEMPTS) so handleGate1PendingRun re-picks it.
 */
export async function reapOrphanedSteps(): Promise<ReapOrphanedStepsResult> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STEP_RUNNING_TIMEOUT_MS).toISOString();
  const now = new Date().toISOString();

  const { data: orphans, error: loadError } = await admin
    .from("run_steps")
    .select("id, run_id, step_name, attempt_count, started_at, input_json")
    .eq("status", "running")
    .lt("started_at", cutoff);

  if (loadError) {
    throw new Error(`Failed to load orphaned run steps: ${loadError.message}`);
  }

  const reaped: ReapedRunStep[] = [];
  const postsFailed: string[] = [];
  const postsReset: string[] = [];

  for (const step of orphans ?? []) {
    const attemptCount = step.attempt_count ?? 1;

    const { error: failError } = await admin
      .from("run_steps")
      .update({
        status: "failed",
        completed_at: now,
        error_message: REAP_ERROR_MESSAGE,
        attempt_count: attemptCount,
      })
      .eq("id", step.id)
      .eq("status", "running");

    if (failError) {
      console.warn(
        `[reapOrphanedSteps] Failed to reap step ${step.id}: ${failError.message}`
      );
      continue;
    }

    reaped.push({
      id: step.id,
      run_id: step.run_id,
      step_name: step.step_name,
      attempt_count: attemptCount,
    });

    if (
      !PRODUCTION_STEP_NAMES.includes(
        step.step_name as (typeof PRODUCTION_STEP_NAMES)[number]
      )
    ) {
      continue;
    }

    const inputJson =
      step.input_json &&
      typeof step.input_json === "object" &&
      !Array.isArray(step.input_json)
        ? (step.input_json as Record<string, unknown>)
        : null;
    const linkedPostId =
      typeof inputJson?.postId === "string" ? inputJson.postId : null;

    let producingQuery = admin
      .from("posts")
      .select("id")
      .eq("run_id", step.run_id)
      .eq("pipeline_stage", "producing");

    if (linkedPostId) {
      producingQuery = producingQuery.eq("id", linkedPostId);
    }

    const { data: producingPosts, error: postsError } = await producingQuery;

    if (postsError) {
      console.warn(
        `[reapOrphanedSteps] Failed to load producing posts for run ${step.run_id}: ${postsError.message}`
      );
      continue;
    }

    if (!producingPosts || producingPosts.length === 0) {
      continue;
    }

    const postIds = producingPosts.map((post) => post.id);

    if (attemptCount >= STEP_MAX_ATTEMPTS) {
      const { error: failPostsError } = await admin
        .from("posts")
        .update({
          pipeline_stage: "failed",
          error_message: `Production step '${step.step_name}' failed after ${attemptCount} attempts (likely timeout or quota).`,
          updated_at: now,
        })
        .in("id", postIds)
        .eq("pipeline_stage", "producing");

      if (failPostsError) {
        console.warn(
          `[reapOrphanedSteps] Failed to fail posts for run ${step.run_id}: ${failPostsError.message}`
        );
        continue;
      }

      postsFailed.push(...postIds);
      continue;
    }

    const resetStage = resetStageForStep(step.step_name);
    const { error: resetError } = await admin
      .from("posts")
      .update({
        pipeline_stage: resetStage,
        error_message: null,
        updated_at: now,
      })
      .in("id", postIds)
      .eq("pipeline_stage", "producing");

    if (resetError) {
      console.warn(
        `[reapOrphanedSteps] Failed to reset posts for run ${step.run_id}: ${resetError.message}`
      );
      continue;
    }

    postsReset.push(...postIds);
  }

  return { reaped, postsFailed, postsReset };
}
