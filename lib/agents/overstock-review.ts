// Server-only: do not import this module into client components.

import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/agents/config";
import {
  estimateClaudeCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";
import {
  overstockAiReviewSchema,
  type OverstockAiReview,
} from "@/lib/overstock/ai-review-types";

export type { OverstockAiReview } from "@/lib/overstock/ai-review-types";
export { overstockAiReviewSchema } from "@/lib/overstock/ai-review-types";

export type OverstockAiReviewBrandContext = {
  tone: string;
  target_audience: string;
  unique_selling_point: string;
  brand_voice_doc: string | null;
};

export type OverstockAiReviewInput = {
  companyId: string;
  product_name: string;
  sku: string;
  category: string | null;
  product_group: string;
  opportunity_score: number;
  rank: number;
  selection_reason: string;
  excess_value_local: number;
  excess_units: number;
  months_of_cover: number;
  quantity_available: number;
  annual_demand_units: number;
  avg_monthly_last_3m: number | null;
  units_sold_last_30d: number | null;
  brand: OverstockAiReviewBrandContext;
};

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced?.[1]?.trim() ?? text.trim();
  return JSON.parse(payload);
}

function buildSystemPrompt(brand: OverstockAiReviewBrandContext): string {
  return [
    "You are an inventory-marketing analyst for Tropical Battery, a Jamaica-based automotive battery, tyre, accessory, and solar distributor.",
    "Interpret products that a DETERMINISTIC scoring system has ALREADY selected for advertising opportunity ranking.",
    "Your job is to explain why this pick is a good (or challenging) advertising candidate and how to promote it on-brand.",
    "You MUST NOT suggest a different product, re-rank, invent or change a score, or propose a new ordering.",
    "Ground every claim in the provided inventory numbers and brand context.",
    "",
    "Brand tone:",
    brand.tone,
    "",
    "Brand target audience:",
    brand.target_audience,
    "",
    "Unique selling point:",
    brand.unique_selling_point,
    "",
    "Brand voice:",
    brand.brand_voice_doc ?? brand.unique_selling_point,
    "",
    "Return ONLY valid JSON with this exact shape:",
    "{",
    '  "narrative": "2-4 sentences grounded in the numbers",',
    '  "campaign_angle": "educational" | "promotional" | "awareness",',
    '  "target_audience": "concrete on-brand audience for THIS product",',
    '  "customer_problem": "the real need the ad speaks to",',
    '  "advertisable": true or false,',
    '  "notes": "optional; required explanation if advertisable is false"',
    "}",
    "advertisable=false is a soft creative-fit flag only — it does not change ranking.",
  ].join("\n");
}

function buildUserPrompt(input: OverstockAiReviewInput): string {
  return [
    "Interpret this already-ranked overstock advertising recommendation.",
    "",
    `Product name: ${input.product_name}`,
    `SKU: ${input.sku}`,
    `Category / product group: ${input.category ?? input.product_group}`,
    `Deterministic rank: ${input.rank}`,
    `Opportunity score (0-100, immutable): ${input.opportunity_score}`,
    "",
    "Inventory snapshot:",
    `- excess_value_local: ${input.excess_value_local}`,
    `- excess_units: ${input.excess_units}`,
    `- months_of_cover: ${input.months_of_cover}`,
    `- quantity_available: ${input.quantity_available}`,
    `- annual_demand_units: ${input.annual_demand_units}`,
    `- avg_monthly_last_3m: ${input.avg_monthly_last_3m ?? "null"}`,
    `- units_sold_last_30d: ${input.units_sold_last_30d ?? "null"}`,
    "",
    "Deterministic selection reason:",
    input.selection_reason,
    "",
    "Produce the JSON review now. Do not re-rank or invent a new score.",
  ].join("\n");
}

/**
 * Claude interpretive review for one deterministic recommendation.
 * No DB access. Returns null on any failure (no retries).
 */
export async function reviewOverstockRecommendation(
  input: OverstockAiReviewInput
): Promise<OverstockAiReview | null> {
  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system: buildSystemPrompt(input.brand),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(input),
        },
      ],
    });

    if (response.usage) {
      await logCostEvent({
        companyId: input.companyId,
        runId: null,
        provider: "claude",
        model: CLAUDE_MODEL,
        stepName: "overstock_ai_review",
        estimatedCostUsd: estimateClaudeCost(
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
      });
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromResponse(textBlock.text);
    } catch {
      return null;
    }

    const validated = overstockAiReviewSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }

    return {
      ...validated.data,
      model: CLAUDE_MODEL,
    };
  } catch {
    return null;
  }
}
