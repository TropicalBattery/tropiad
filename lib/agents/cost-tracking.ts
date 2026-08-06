// Server-only: do not import this module into client components.

import { createAdminClient } from "@/lib/supabase/admin";

export const COST_ESTIMATES = {
  claude_sonnet_per_1k_input_tokens: 0.003,
  claude_sonnet_per_1k_output_tokens: 0.015,
  flux_schnell_per_image: 0.003,
  veo_per_second: 0.1,
} as const;

export function estimateClaudeCost(
  inputTokens: number,
  outputTokens: number
): number {
  return (
    (inputTokens / 1000) * COST_ESTIMATES.claude_sonnet_per_1k_input_tokens +
    (outputTokens / 1000) * COST_ESTIMATES.claude_sonnet_per_1k_output_tokens
  );
}

export function estimateFluxCost(): number {
  return COST_ESTIMATES.flux_schnell_per_image;
}

export function estimateVeoCost(durationSeconds: number = 8): number {
  return durationSeconds * COST_ESTIMATES.veo_per_second;
}

type LogCostEventParams = {
  companyId: string;
  runId?: string | null;
  postId?: string | null;
  provider: "claude" | "flux" | "veo" | "zernio";
  model?: string | null;
  stepName: string;
  estimatedCostUsd: number;
};

export async function logCostEvent(params: LogCostEventParams): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cost_events").insert({
      company_id: params.companyId,
      run_id: params.runId ?? null,
      post_id: params.postId ?? null,
      provider: params.provider,
      model: params.model ?? null,
      step_name: params.stepName,
      estimated_cost_usd: params.estimatedCostUsd,
    });

    if (error) {
      console.warn(`[cost-tracking] Failed to log cost event: ${error.message}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown cost logging error";
    console.warn(`[cost-tracking] Failed to log cost event: ${message}`);
  }
}
