// Server-only: do not import this module into client components.

import type Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/agents/config";
import {
  estimateClaudeCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";
import type { AgentCostContext } from "@/lib/agents/types";
import type { BrandConfig } from "@/lib/supabase/types";
import { formatIndustries } from "@/lib/validations/brand-config-normalize";
import { parseVisualAudienceProfile } from "@/lib/validations/visual-audience";
import type { VisualAudienceProfile } from "@/lib/validations/visual-audience";

const SYSTEM_PROMPT = `You write production-ready prompts for AI image and video generation models used in social media marketing across many industries.

Your prompts must be vivid, specific, realistic, and safe for commercial use.

Never include brand names, logos, watermarks, text overlays, signage text, copyrighted characters, competitor names, or instructions to reproduce a specific person's likeness.

Focus on the scene, setting, composition, camera angle, lighting, materials, mood, and color palette.

Ensure physical realism appropriate to the subject matter. Avoid distorted objects, impossible geometry, broken reflections, fake or garbled text, extra or missing limbs on people, and unrealistic proportions. Apply common sense realism checks relevant to whatever the concept depicts.`;

function buildDemographicModifier(
  profile: VisualAudienceProfile | null
): string {
  if (!profile || profile.demographic === "local") {
    return "Feature Black Jamaican individuals. Use authentic Jamaican settings, architecture, and cultural context appropriate to the brand.";
  }

  if (profile.demographic === "tourist") {
    return "Feature a diverse international group of people. Use upscale Caribbean or resort-adjacent settings appropriate to the brand.";
  }

  const localPct = profile.local_pct ?? 70;

  if (localPct >= 70) {
    return "Feature predominantly Black Jamaican individuals with some international diversity. Use authentic Caribbean settings.";
  }

  if (localPct <= 30) {
    return "Feature a diverse international mix of people with some Caribbean locals. Use aspirational Caribbean settings.";
  }

  return "Feature a balanced multicultural mix of people reflecting Caribbean tourism. Use authentic yet aspirational Caribbean settings.";
}

type WriteVisualPromptParams = {
  concept: string;
  contentType: "image" | "video" | "carousel";
  brandConfig: BrandConfig;
  context?: AgentCostContext;
};

function formatColorPalette(brandConfig: BrandConfig): string {
  const base = [
    brandConfig.primary_color,
    brandConfig.secondary_color,
    brandConfig.accent_color,
  ]
    .filter(Boolean)
    .join(", ");

  const palette = brandConfig.brand_color_palette;
  if (!palette || typeof palette !== "object" || Array.isArray(palette)) {
    return base || "not specified";
  }

  const extras: string[] = [];
  for (const group of ["primary", "secondary"] as const) {
    const entries = (palette as Record<string, unknown>)[group];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }
      const row = entry as Record<string, unknown>;
      const hex = typeof row.hex === "string" ? row.hex : null;
      const name = typeof row.name === "string" ? row.name : null;
      if (hex && !base.toUpperCase().includes(hex.toUpperCase())) {
        extras.push(name ? `${name} (${hex})` : hex);
      }
    }
  }

  if (extras.length === 0) {
    return base || "not specified";
  }

  return `${base}; also use sparingly: ${extras.join(", ")}`;
}

function formatVisualGuidelines(brandConfig: BrandConfig): string[] {
  const guidelines = brandConfig.visual_guidelines;
  if (!guidelines || typeof guidelines !== "object" || Array.isArray(guidelines)) {
    return [];
  }

  const labels: Record<string, string> = {
    lifestyle_imagery: "Lifestyle imagery",
    lifestyle_imagery_internal: "Internal lifestyle imagery",
    product_imagery: "Product imagery",
    layout: "Layout",
    logo_usage: "Logo usage",
    logo_placement: "Logo placement",
  };

  const lines: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const value = (guidelines as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      lines.push(`- ${label}: ${value.trim()}`);
    }
  }

  return lines;
}

function buildBusinessContext(brandConfig: BrandConfig): string {
  const demographicModifier = buildDemographicModifier(
    parseVisualAudienceProfile(brandConfig.visual_audience_profile)
  );

  const lines = [
    `- Industry: ${formatIndustries(brandConfig.industry)}`,
    `- Target audience: ${brandConfig.target_audience || "not specified"}`,
    `- Demographic context: ${demographicModifier}`,
    `- Visual style: ${brandConfig.image_style || "not specified"}`,
    `- Color palette: ${formatColorPalette(brandConfig)}`,
  ];

  const typography = brandConfig.brand_typography?.trim();
  if (typography) {
    lines.push(
      `- Typography (for mood/design language only; never render text in the image): ${typography}`
    );
  }

  const guidelineLines = formatVisualGuidelines(brandConfig);
  if (guidelineLines.length > 0) {
    lines.push("- Brand visual guidelines (follow these):");
    lines.push(...guidelineLines);
  }

  return lines.join("\n");
}

function buildUserPrompt(
  concept: string,
  contentType: WriteVisualPromptParams["contentType"],
  brandConfig: BrandConfig
): string {
  const businessContext = buildBusinessContext(brandConfig);

  if (contentType === "video") {
    return `Write a detailed cinematic video generation prompt for this post concept:

Concept: ${concept}

Business context:
${businessContext}

Requirements:
- Single paragraph, 70 to 130 words
- Describe an 8-second vertical social video, aspect ratio 9:16
- Include scene, camera movement, pacing, lighting, realistic materials, color grade
- Apply realism considerations appropriate to the subject matter in the concept
- Avoid logos, text overlays, signage text, brand names, competitor names
- Return only the prompt text`;
  }

  if (contentType === "carousel") {
    return `Write a detailed image generation prompt for this post concept:

Concept: ${concept}

Business context:
${businessContext}

Requirements:
- Single paragraph, 50 to 90 words
- Suitable for a 1:1 social media carousel cover image
- Realistic commercial photography style unless brand style indicates otherwise (e.g. illustration, 3D render)
- Include setting, composition, lighting, mood, color treatment
- Leave clean visual space where text could later be placed, but do not ask the image model to render any text
- Apply realism considerations appropriate to the subject matter described in the concept
- Do not mention logos, brand names, text overlays, signage text, or competitor names
- Return only the prompt text`;
  }

  return `Write a detailed image generation prompt for this post concept:

Concept: ${concept}

Business context:
${businessContext}

Requirements:
- Single paragraph, 50 to 90 words
- Suitable for a 1:1 social media feed image
- Realistic commercial photography style unless brand style indicates otherwise (e.g. illustration, 3D render)
- Include setting, composition, lighting, mood, color treatment
- Apply realism considerations appropriate to the subject matter described in the concept
- Do not mention logos, brand names, text overlays, signage text, or competitor names
- Return only the prompt text`;
}

function getResponseText(content: Anthropic.Message["content"]): string {
  const textBlocks = content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text);

  if (textBlocks.length === 0) {
    return "";
  }

  return textBlocks.join("\n");
}

const PREAMBLE_PATTERNS = [
  /^here(?:'s| is) the (?:image |video |generation )?prompt:?\s*/i,
  /^prompt:?\s*/i,
  /^generated prompt:?\s*/i,
  /^the prompt:?\s*/i,
];

function stripPreamble(text: string): string {
  let cleaned = text.trim();

  const fenced = cleaned.match(/^```(?:[\w-]+)?\s*([\s\S]*?)```$/);
  if (fenced?.[1]) {
    cleaned = fenced[1].trim();
  }

  for (const pattern of PREAMBLE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

export async function writeVisualPrompt(
  params: WriteVisualPromptParams
): Promise<string> {
  const { concept, contentType, brandConfig, context } = params;

  if (!concept.trim()) {
    throw new Error("Concept text is required to write a visual prompt.");
  }

  const anthropic = getAnthropicClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(concept.trim(), contentType, brandConfig),
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate visual prompt with Claude.";
    throw new Error(`Visual prompt generation failed: ${message}`);
  }

  if (context && response.usage) {
    await logCostEvent({
      companyId: context.companyId,
      runId: context.runId ?? null,
      postId: context.postId ?? null,
      provider: "claude",
      model: CLAUDE_MODEL,
      stepName: "visual_prompt",
      estimatedCostUsd: estimateClaudeCost(
        response.usage.input_tokens,
        response.usage.output_tokens
      ),
    });
  }

  const prompt = stripPreamble(getResponseText(response.content));

  if (!prompt) {
    throw new Error("Claude returned an empty visual prompt.");
  }

  return prompt;
}

export async function writeVideoPrompt({
  concept,
  brandConfig,
  context,
  demographic,
  voiceOverScript,
}: {
  concept: string;
  contentType: string;
  brandConfig: BrandConfig;
  context?: string;
  demographic?: string;
  voiceOverScript?: string | null;
}): Promise<string> {
  const profile = parseVisualAudienceProfile(brandConfig.visual_audience_profile);
  const audienceDemographic = demographic ?? profile?.demographic ?? "local";

  const audioRules = voiceOverScript
    ? `AUDIO RULES:
- Include a warm, natural spoken voice delivering the provided script
- Ambient environmental sounds should play underneath the voice
- The voice should feel conversational and authentic, not overly produced`
    : `AUDIO RULES -- this is critical:
- Never include people speaking, voiceovers, or dialogue
- Specify ambient environmental sounds only
- Examples for food/café: "the gentle sizzle of food on a grill, soft background café murmur, light Caribbean rhythm in the background"
- Examples for retail: "soft upbeat background music, ambient store atmosphere, subtle product sounds"
- Examples for lifestyle: "gentle ocean waves, warm ambient music, natural outdoor atmosphere"
- Always end audio direction with: "no dialogue, no voiceover"`;

  const systemPrompt = `You are a social media video director specialising in short-form Instagram Reels for Caribbean brands. You write cinematic motion prompts for Google Veo 3.1 which generates video AND synchronized audio natively.

Your prompts must specify THREE things:

1. VISUAL -- specific camera movement, composition, lighting
2. AUDIO -- exact sounds Veo should generate (be very specific)
3. MOOD -- the emotional feel

${audioRules}

FORMAT: One flowing paragraph, 3-4 sentences max.
Never mention: text, logos, watermarks, captions -- added in post.
Always: 9:16 vertical frame, natural lighting, authentic Caribbean setting.`;

  const industries = Array.isArray(brandConfig.industry)
    ? brandConfig.industry
    : brandConfig.industry
      ? [brandConfig.industry]
      : [];
  const isFoodBrand = industries.some((entry) =>
    entry.toLowerCase().includes("food")
  );

  const guidelineLines = formatVisualGuidelines(brandConfig);
  const typography = brandConfig.brand_typography?.trim();

  let userPrompt = `Write a Veo 3.1 video generation prompt for this concept:

"${concept}"

Brand context:
- Business: ${(brandConfig as BrandConfig & { name?: string }).name ?? "the brand"}
- Industry: ${industries.length > 0 ? industries.join(", ") : "lifestyle"}
- Tone: ${brandConfig.tone ?? "warm and authentic"}
- Audience: ${audienceDemographic}
- Visual style: ${brandConfig.image_style || "not specified"}
- Color palette: ${formatColorPalette(brandConfig)}
${typography ? `- Typography mood (do not render on-screen text): ${typography}\n` : ""}${
    guidelineLines.length > 0
      ? `Brand visual guidelines:\n${guidelineLines.join("\n")}\n`
      : ""
  }
Requirements:
- Open with a specific cinematic camera move
- Describe ambient audio explicitly${voiceOverScript ? " with the spoken voiceover integrated naturally" : " -- no dialogue, no voiceover, natural sounds only"}
- Warm Caribbean lighting
- 8 seconds of premium content
- Vertical 9:16 frame
- Follow brand colour and imagery guidelines above when composing the scene

Return only the video generation prompt, nothing else.`;

  if (context) {
    userPrompt += `\n\nAdditional context: ${context}`;
  }

  if (voiceOverScript) {
    userPrompt += `

Voiceover: A warm, natural ${audienceDemographic === "local" ? "Jamaican" : "Caribbean"} voice clearly says: "${voiceOverScript}" — audible over the ambient sounds, conversational and authentic, not overly produced.`;
  } else {
    userPrompt += `

No dialogue or voiceover. Ambient sounds only — ${isFoodBrand ? "kitchen sounds, café atmosphere, gentle background music" : "natural environmental sounds, soft background music"}. No speaking.`;
  }

  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  return text.trim();
}
