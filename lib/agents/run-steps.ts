// Server-only: do not import this module into client components.

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, RunStep } from "@/lib/supabase/types";

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
