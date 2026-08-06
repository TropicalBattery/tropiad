import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { CLAUDE_MODEL, getAnthropicClient, isSupportedSearchCountry } from "@/lib/agents/config";
import {
  estimateClaudeCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";
import type { TrendBrief, TrendBriefAngle } from "@/lib/agents/types";
import type { BrandConfig } from "@/lib/supabase/types";
import {
  formatIndustries,
  normalizeIndustries,
} from "@/lib/validations/brand-config-normalize";

const SYSTEM_PROMPT = `You are a trend research assistant for a social media content team serving small businesses across many industries. Your job is to find current, relevant, and timely content angles that can become social media posts for the specific business described in the user prompt.

Focus on current information, preferably from the last 7 days. Also consider seasonal, cultural, weather, holiday, and business-calendar angles relevant to the next 2 weeks for the business's market.

Be specific to THIS business and industry. Avoid generic advice. Do not write finished social media posts. Return useful angles that a copywriter can develop.

Do not copy competitor wording. Do not suggest using competitor logos, copyrighted assets, or private account content. If competitor handles are supplied but cannot be accessed reliably, note this in risk_notes.`;

const trendAngleSchema = z.object({
  angle: z.string().min(1),
  why_now: z.string().min(1),
  suggested_content_type: z.enum(["image", "video", "carousel"]),
  source_urls: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  risk_notes: z.string().nullable(),
});

const trendResponseSchema = z.object({
  angles: z.array(trendAngleSchema).min(1),
});

class TrendScoutParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrendScoutParseError";
  }
}

function normalizeStringArray(value: string[] | null | undefined): string[] {
  return (value ?? []).filter((item) => item.trim().length > 0);
}

function buildUserPrompt(brandConfig: BrandConfig): string {
  const topicsToCover = normalizeStringArray(brandConfig.topics_to_cover);
  const topicsToAvoid = normalizeStringArray(brandConfig.topics_to_avoid);
  const competitorHandles = normalizeStringArray(brandConfig.competitor_handles);

  return `Industry: ${formatIndustries(brandConfig.industry)}
Business description: ${brandConfig.unique_selling_point || "not specified"}
Topics of interest: ${topicsToCover.length > 0 ? topicsToCover.join(", ") : "none specified"}
Topics to avoid: ${topicsToAvoid.length > 0 ? topicsToAvoid.join(", ") : "none specified"}
Competitor accounts to check: ${competitorHandles.length > 0 ? competitorHandles.join(", ") : "none specified"}
Target audience: ${brandConfig.target_audience || "not specified"}
Market/location: ${brandConfig.timezone || "not specified"}

Find 5 to 8 timely social media content angles SPECIFIC to this business and its industry.

For each angle, include: angle, why_now, suggested_content_type, source_urls, confidence, risk_notes.

Return valid JSON only. No markdown. No explanation.

JSON shape:
{
  "angles": [
    {
      "angle": "string",
      "why_now": "string",
      "suggested_content_type": "image | video | carousel",
      "source_urls": ["string"],
      "confidence": "low | medium | high",
      "risk_notes": "string or null"
    }
  ]
}`;
}

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced?.[1]?.trim() ?? text.trim();
  return JSON.parse(payload);
}

function getResponseText(content: Anthropic.Message["content"]): string {
  const textBlocks = content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text);

  if (textBlocks.length === 0) {
    throw new TrendScoutParseError("Claude returned no text response.");
  }

  return textBlocks.join("\n");
}

function normalizeAngles(angles: TrendBriefAngle[]): TrendBriefAngle[] {
  return angles.map((angle) => ({
    ...angle,
    source_urls: angle.source_urls.filter((url) => url.trim().length > 0),
    risk_notes: angle.risk_notes?.trim() ? angle.risk_notes.trim() : null,
  }));
}

function parseTrendAngles(rawText: string): TrendBriefAngle[] {
  let parsed: unknown;

  try {
    parsed = parseJsonFromResponse(rawText);
  } catch {
    throw new TrendScoutParseError("Failed to parse Claude JSON response.");
  }

  const validated = trendResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new TrendScoutParseError("Claude returned an invalid trend brief shape.");
  }

  return normalizeAngles(validated.data.angles);
}

function logTrendScoutWarning(
  brandConfig: BrandConfig,
  message: string,
  detail?: string
): void {
  const suffix = detail ? ` (${detail})` : "";
  console.warn(
    `[TrendScout] company=${brandConfig.company_id} industry=${formatIndustries(brandConfig.industry)}: ${message}${suffix}`
  );
}

function buildFallbackBrief(brandConfig: BrandConfig): TrendBrief {
  const topicsToCover = normalizeStringArray(brandConfig.topics_to_cover);
  const industries = normalizeIndustries(brandConfig.industry);
  const topicFocus = topicsToCover[0] ?? industries[0] ?? "your services";
  const uniqueSellingPoint =
    brandConfig.unique_selling_point?.trim() || "your offering";
  const industry = industries[0] ?? "your industry";
  const targetAudience =
    brandConfig.target_audience?.trim() || "your customers";

  const fallbackRiskNotes =
    "Generated from fallback template, not live research";

  const angles: TrendBriefAngle[] = [
    {
      angle: `Share a recent project, case, or customer story related to ${topicFocus}`,
      why_now:
        "Proof-led stories help prospects see real outcomes and build trust quickly.",
      suggested_content_type: "image",
      source_urls: [],
      confidence: "low",
      risk_notes: fallbackRiskNotes,
    },
    {
      angle: `Explain a practical benefit of ${uniqueSellingPoint}`,
      why_now:
        "Educational posts that connect benefits to customer needs perform well year-round.",
      suggested_content_type: "image",
      source_urls: [],
      confidence: "low",
      risk_notes: fallbackRiskNotes,
    },
    {
      angle: `Answer a common question your customers ask about ${industry}`,
      why_now:
        "FAQ-style content reduces friction in the buying journey and invites engagement.",
      suggested_content_type: "carousel",
      source_urls: [],
      confidence: "low",
      risk_notes: fallbackRiskNotes,
    },
    {
      angle: `Show behind-the-scenes of how you deliver value to ${targetAudience}`,
      why_now:
        "Authentic process content humanizes the brand and strengthens audience connection.",
      suggested_content_type: "video",
      source_urls: [],
      confidence: "low",
      risk_notes: fallbackRiskNotes,
    },
    {
      angle: `Highlight what makes you different: ${uniqueSellingPoint}`,
      why_now:
        "Differentiation posts reinforce positioning when competitors are active in the market.",
      suggested_content_type: "image",
      source_urls: [],
      confidence: "low",
      risk_notes: fallbackRiskNotes,
    },
  ];

  const brief: TrendBrief = {
    fallback_used: true,
    generated_at: new Date().toISOString(),
    industry: formatIndustries(brandConfig.industry, "Unknown"),
    angles,
    raw_text: "",
  };

  brief.raw_text = renderTrendBriefBullets(brief);
  return brief;
}

function buildTrendBrief(
  brandConfig: BrandConfig,
  angles: TrendBriefAngle[],
  fallbackUsed: boolean,
  rawText: string
): TrendBrief {
  const brief: TrendBrief = {
    fallback_used: fallbackUsed,
    generated_at: new Date().toISOString(),
    industry: formatIndustries(brandConfig.industry, "Unknown"),
    angles,
    raw_text: rawText,
  };

  if (!brief.raw_text.trim()) {
    brief.raw_text = renderTrendBriefBullets(brief);
  }

  return brief;
}

export function renderTrendBriefBullets(brief: TrendBrief): string {
  return brief.angles
    .map((angle) => `- ${angle.angle}: ${angle.why_now}`)
    .join("\n");
}

export async function runTrendScout(
  brandConfig: BrandConfig,
  context?: { companyId: string; runId?: string }
): Promise<TrendBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    logTrendScoutWarning(
      brandConfig,
      "Missing ANTHROPIC_API_KEY, using fallback brief"
    );
    return buildFallbackBrief(brandConfig);
  }

  let anthropic: Anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Anthropic client unavailable";
    logTrendScoutWarning(brandConfig, "Client setup failed, using fallback", message);
    return buildFallbackBrief(brandConfig);
  }

  const timezone = brandConfig.timezone?.trim() || "America/Jamaica";
  const country = brandConfig.country?.trim() || "JM";
  const searchCountry = isSupportedSearchCountry(country)
    ? country.toUpperCase()
    : "US";

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
          user_location: {
            type: "approximate",
            country: searchCountry,
            timezone,
          },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserPrompt(brandConfig),
        },
      ],
    });

    if (context && response.usage) {
      await logCostEvent({
        companyId: context.companyId,
        runId: context.runId ?? null,
        provider: "claude",
        model: CLAUDE_MODEL,
        stepName: "trend_research",
        estimatedCostUsd: estimateClaudeCost(
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
      });
    }

    const rawText = getResponseText(response.content);

    try {
      const angles = parseTrendAngles(rawText);
      return buildTrendBrief(brandConfig, angles, false, rawText);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid trend brief response";
      logTrendScoutWarning(
        brandConfig,
        "Parse validation failed, using fallback",
        message
      );
      return buildFallbackBrief(brandConfig);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Trend scout request failed";
    logTrendScoutWarning(
      brandConfig,
      "API call failed, using fallback brief",
      message
    );
    return buildFallbackBrief(brandConfig);
  }
}
