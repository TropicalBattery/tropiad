// Server-only: do not import this module into client components.

import { z } from "zod";

import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/agents/config";
import {
  estimateClaudeCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";

export type BrandHelperInput = {
  whatYouDo: string;
  idealCustomer: string;
  whatMakesYouDifferent: string;
  personality: string;
};

export type BrandHelperOutput = {
  unique_selling_point: string;
  target_audience: string;
  brand_voice_doc: string;
  tone: "professional" | "casual" | "playful" | "bold";
  suggested_topics_to_cover: string[];
};

const SYSTEM_PROMPT = `You are a marketing consultant helping a small business owner articulate their brand for a social media content strategy. They have answered some simple questions in their own words. Your job is to turn their answers into polished, specific marketing language - without losing what makes their business unique. Avoid generic corporate language. Be concrete and specific, reflecting their actual words where possible.`;

const brandHelperResponseSchema = z.object({
  unique_selling_point: z.string().min(1),
  target_audience: z.string().min(1),
  brand_voice_doc: z.string().min(1),
  tone: z.enum(["professional", "casual", "playful", "bold"]),
  suggested_topics_to_cover: z.array(z.string().min(1)).min(1),
});

class BrandHelperParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandHelperParseError";
  }
}

function buildUserPrompt(input: BrandHelperInput): string {
  return `Here's what the business owner told us:

What they do: ${input.whatYouDo}
Their ideal customer: ${input.idealCustomer}
What makes them different: ${input.whatMakesYouDifferent}
Their brand personality: ${input.personality}

Based on this, produce:

1. unique_selling_point: One sharp sentence capturing what makes this business different. Specific, not generic.

2. target_audience: A clear description of who they serve - demographics, needs, context. 2-3 sentences.

3. brand_voice_doc: A full brand voice guide for social media (100-150 words) - how this brand should sound: tone, vocabulary, what to emphasize, what to avoid. Write this as instructions to a copywriter.

4. tone: pick the closest match - professional, casual, playful, or bold - based on their personality description

5. suggested_topics_to_cover: 6-8 specific content topics this business should post about, based on what they do and their audience

Return valid JSON only, no markdown, no explanation.

JSON shape:
{
  "unique_selling_point": "string",
  "target_audience": "string",
  "brand_voice_doc": "string",
  "tone": "professional | casual | playful | bold",
  "suggested_topics_to_cover": ["string"]
}`;
}

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced?.[1]?.trim() ?? text.trim();
  return JSON.parse(payload);
}

function getResponseText(
  content: Array<{ type: string; text?: string }>
): string {
  const textBlocks = content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text as string);

  if (textBlocks.length === 0) {
    throw new BrandHelperParseError("Claude returned no text response.");
  }

  return textBlocks.join("\n");
}

function parseBrandHelperOutput(rawText: string): BrandHelperOutput {
  let parsed: unknown;

  try {
    parsed = parseJsonFromResponse(rawText);
  } catch {
    throw new BrandHelperParseError("Failed to parse Claude JSON response.");
  }

  const validated = brandHelperResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new BrandHelperParseError(
      "Claude returned an invalid brand helper shape."
    );
  }

  return validated.data;
}

export async function generateBrandHelperOutput(
  input: BrandHelperInput,
  context?: { companyId?: string }
): Promise<BrandHelperOutput> {
  const anthropic = getAnthropicClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(input),
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brand helper request failed.";
    throw new Error(`Brand helper generation failed: ${message}`);
  }

  if (context?.companyId && response.usage) {
    await logCostEvent({
      companyId: context.companyId,
      provider: "claude",
      model: CLAUDE_MODEL,
      stepName: "brand_helper",
      estimatedCostUsd: estimateClaudeCost(
        response.usage.input_tokens,
        response.usage.output_tokens
      ),
    });
  }

  const rawText = getResponseText(response.content);

  try {
    return parseBrandHelperOutput(rawText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid brand helper response.";
    throw new BrandHelperParseError(message);
  }
}
