import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/agents/config";
import {
  estimateClaudeCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";
import { getRecentRejectionSummary } from "@/lib/agents/rejection-feedback";
import { renderTrendBriefBullets } from "@/lib/agents/trend-scout";
import type { TrendBrief } from "@/lib/agents/types";
import type { SuggestedTimeTag } from "@/lib/agents/scheduling-heuristics";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandConfig } from "@/lib/supabase/types";
import { getRelevantHolidays } from "@/lib/utils/holiday-dates";
import { formatIndustries } from "@/lib/validations/brand-config-normalize";
import { parseVisualAudienceProfile } from "@/lib/validations/visual-audience";
import type { VisualAudienceProfile } from "@/lib/validations/visual-audience";

export type Platform = "instagram" | "linkedin" | "x" | "facebook";

type CaptionResult = {
  caption: string;
  hashtags: string[];
};

type ConceptResult = {
  platform: string;
  concept: string;
  content_type: string;
  content_category: string;
  suggested_time_tag: SuggestedTimeTag;
};

type RawConceptResult = {
  platform: string;
  concept: string;
  content_type: string;
  content_category?: string;
  suggested_time_tag?: string;
  voice_over?: string | null;
};

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
};

const PLATFORM_CONSTRAINTS: Record<Platform, string> = {
  instagram:
    "Engaging, 150-200 words, storytelling tone, include 5-10 relevant hashtags.",
  linkedin:
    "Professional insight, 100-150 words, value-driven, include 3-5 hashtags.",
  x: "Punchy and concise, maximum 240 characters total, include 2-3 hashtags.",
  facebook:
    "Conversational, 100-150 words, community-focused, include 3-5 hashtags.",
};

function parseJsonFromResponse<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced?.[1]?.trim() ?? text.trim();
  return JSON.parse(payload) as T;
}

function normalizeHashtags(hashtags: string[]): string[] {
  return hashtags.map((tag) => tag.replace(/^#+/, "").trim()).filter(Boolean);
}

function buildCaptionSystemPrompt(brand: BrandConfig): string {
  const avoidTopics =
    brand.topics_to_avoid.length > 0
      ? brand.topics_to_avoid.join(", ")
      : "None specified";

  return [
    "You are an expert social media copywriter.",
    "Write on-brand captions that match the client's voice exactly.",
    "",
    "Brand voice foundation:",
    brand.brand_voice_doc ?? brand.unique_selling_point,
    "",
    `Tone: ${brand.tone}`,
    `Target audience: ${brand.target_audience}`,
    `Unique selling point: ${brand.unique_selling_point}`,
    `Topics to avoid: ${avoidTopics}`,
    "",
    "Return ONLY valid JSON with this shape:",
    '{ "caption": "...", "hashtags": ["tag1", "tag2"] }',
    "Do not include # in hashtag values.",
  ].join("\n");
}

function buildCaptionUserPrompt(
  platform: Platform,
  concept: string
): string {
  const label = PLATFORM_LABELS[platform];
  const constraints = PLATFORM_CONSTRAINTS[platform];

  return [
    `Platform: ${label}`,
    `Concept: ${concept}`,
    "",
    "Platform constraints:",
    constraints,
    "",
    "Write the caption and hashtags now.",
  ].join("\n");
}

async function fetchBrandConfig(companyId: string): Promise<BrandConfig> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_configs")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? `Brand config not found for company ${companyId}.`
    );
  }

  return data;
}

export async function generateCaption(
  companyId: string,
  postId: string,
  platform: Platform,
  concept: string
): Promise<CaptionResult> {
  const brand = await fetchBrandConfig(companyId);
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    system: buildCaptionSystemPrompt(brand),
    messages: [
      {
        role: "user",
        content: buildCaptionUserPrompt(platform, concept),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned an empty response.");
  }

  const parsed = parseJsonFromResponse<CaptionResult>(textBlock.text);
  if (!parsed.caption || !Array.isArray(parsed.hashtags)) {
    throw new Error("Claude response missing caption or hashtags.");
  }

  const result: CaptionResult = {
    caption: parsed.caption.trim(),
    hashtags: normalizeHashtags(parsed.hashtags),
  };

  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("posts")
    .update({
      caption: result.caption,
      hashtags: result.hashtags,
      pipeline_stage: "visual",
    })
    .eq("id", postId)
    .eq("company_id", companyId);

  if (updateError) {
    throw new Error(`Failed to update post: ${updateError.message}`);
  }

  return result;
}

function buildConceptsSystemPrompt(brand: BrandConfig): string {
  const activePlatforms =
    brand.active_platforms.length > 0
      ? brand.active_platforms.join(", ")
      : "Instagram, LinkedIn, X, Facebook";

  return [
    "You are a senior social media strategist generating weekly post concepts.",
    "",
    "Brand voice foundation:",
    brand.brand_voice_doc ?? brand.unique_selling_point,
    "",
    `Tone: ${brand.tone}`,
    `Target audience: ${brand.target_audience}`,
    `Industry: ${formatIndustries(brand.industry)}`,
    `Topics to cover: ${brand.topics_to_cover.join(", ") || "General brand themes"}`,
    `Topics to avoid: ${brand.topics_to_avoid.join(", ") || "None specified"}`,
    "",
    `Active platforms: ${activePlatforms}`,
    `Content mix — Promotional: ${brand.promotional_pct}%, Educational: ${brand.educational_pct}%, Engagement: ${brand.engagement_pct}%`,
    "",
    "Generate exactly 7 post concepts as a JSON array.",
    "Each object must follow this exact structure:",
    '{ "platform": "Instagram", "concept": "Full concept description here", "content_type": "Image" | "Video" | "Carousel", "content_category": "educational" | "promotional" | "engagement", "suggested_time_tag": "morning" | "midday" | "evening" | "anytime", "voice_over": "script here max 15 words" | null }',
    "voice_over rules:",
    "- Required on every object — use null for Image and Carousel concepts",
    "- Required for ALL Video concepts — a short script string or null only for atmospheric/cinematic Video",
    "- For every Video concept, the concept string MUST end with a VOICE_OVER: tag on the final line (VOICE_OVER: \"script\" or VOICE_OVER: none). This tag is MANDATORY for Video concepts. Omitting it will cause a pipeline error.",
    "- At least 2 of the Video concepts must have a non-null voice_over",
    "content_type must be one of: Image, Video, Carousel.",
    "content_category must be one of: educational, promotional, engagement.",
    "suggested_time_tag must be one of: morning, midday, evening, anytime.",
    "Choose suggested_time_tag from content nature (e.g. morning prep routine -> morning, lunch special -> midday, dinner ambiance -> evening, FAQ carousel -> anytime).",
    "Distribute concepts across active platforms according to the content mix ratios.",
    "Assign each concept a content_category aligned with the promotional, educational, or engagement mix.",
    "",
    "Return ONLY valid JSON array, no markdown.",
    '[{ "platform": "Instagram", "concept": "...", "content_type": "Video", "content_category": "promotional", "suggested_time_tag": "midday", "voice_over": "Fresh bowls built right. Your way. Every single time." }]',
  ].join("\n");
}

function buildIdeationDemographicContext(
  profile: VisualAudienceProfile | null
): string {
  if (!profile || profile.demographic === "local") {
    return "Target audience is predominantly local Jamaican. Concepts should reflect Jamaican culture, language patterns, local references, and resonate with a Black Jamaican audience. Patois phrases used sparingly where appropriate for the brand tone.";
  }

  if (profile.demographic === "tourist") {
    return "Target audience is predominantly tourists and international visitors. Concepts should highlight the Caribbean experience, be accessible to international audiences, and avoid heavy local slang.";
  }

  const localPct = profile.local_pct ?? 70;

  if (localPct >= 70) {
    return "Target audience is mixed but majority local Jamaican. Concepts should lead with local cultural relevance while remaining accessible to international visitors.";
  }

  return "Target audience is mixed between locals and international tourists. Balance local authenticity with international accessibility in all concepts.";
}

function buildConceptsUserPrompt(
  trendBrief: TrendBrief,
  rejectionSummary: string
): string {
  const sections = [
    "Trend brief for this week:",
    renderTrendBriefBullets(trendBrief),
    "",
    trendBrief.raw_text.trim()
      ? `Additional trend context:\n${trendBrief.raw_text.trim()}`
      : "",
    rejectionSummary.trim() ? rejectionSummary.trim() : "",
    "",
    "Generate 7 on-brand post concepts informed by this trend brief.",
  ];

  return sections.filter(Boolean).join("\n");
}

function normalizePlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  switch (normalized) {
    case "instagram":
      return "Instagram";
    case "linkedin":
      return "LinkedIn";
    case "x":
    case "twitter":
      return "X";
    case "facebook":
      return "Facebook";
    default:
      return platform.trim();
  }
}

function normalizeContentType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "video") return "Video";
  if (normalized === "carousel") return "Carousel";
  return "Image";
}

function normalizeSuggestedTimeTag(value: string | undefined): SuggestedTimeTag {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "morning" ||
    normalized === "midday" ||
    normalized === "evening" ||
    normalized === "anytime"
  ) {
    return normalized;
  }

  return "anytime";
}

function normalizeContentCategory(
  contentCategory: string | undefined,
  index: number
): "educational" | "promotional" | "engagement" {
  const normalized = contentCategory?.trim().toLowerCase();

  if (
    normalized === "educational" ||
    normalized === "promotional" ||
    normalized === "engagement"
  ) {
    return normalized;
  }

  const fallback: Array<"educational" | "promotional" | "engagement"> = [
    "educational",
    "promotional",
    "engagement",
    "educational",
    "promotional",
    "engagement",
    "educational",
  ];

  return fallback[index % fallback.length];
}

export type OverstockIdeationContext = {
  skus: string[];
  productNames: string[];
  postCount: number;
  strategy?: {
    campaign_angle: string;
    target_audience: string;
    customer_problem: string;
    narrative: string;
  } | null;
  sourceRecommendationId?: string | null;
};

function buildOverstockContext(
  overstock: OverstockIdeationContext
): string {
  if (overstock.skus.length === 0 || overstock.postCount < 1) {
    return "";
  }

  const lines = overstock.skus.map((sku, index) => {
    const name = overstock.productNames[index]?.trim();
    return name ? `- ${name} (SKU ${sku})` : `- SKU ${sku}`;
  });

  const total = 7 + overstock.postCount;

  let strategyBlock = "";
  if (overstock.strategy) {
    const s = overstock.strategy;
    strategyBlock = `

Campaign strategy (execute this for the ${overstock.postCount} overstock-featured concept(s)):
- Campaign angle: ${s.campaign_angle}
- Target audience: ${s.target_audience}
- Customer problem to address: ${s.customer_problem}
- Narrative grounding: ${s.narrative}
Speak to this audience, address this problem, and execute this campaign angle. Keep the concepts grounded in the narrative above.`;
  }

  return `

Overstock / excess inventory to feature this week -- generate exactly ${overstock.postCount} ADDITIONAL concepts (on top of the normal 7) that specifically feature these products as clearing excess / featured stock. Frame them as timely deals or spotlight posts for inventory that needs to move. Prefer promotional content_category for these overstock concepts.
Products:
${lines.join("\n")}${strategyBlock}

IMPORTANT: Return a JSON array with exactly ${total} concepts total (${7} regular + ${overstock.postCount} overstock-featured).`;
}

async function getActivePromotions(
  companyId: string,
  weekStart: string
): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("promotions")
    .select(
      "title, description, discount_type, discount_value, promo_code, start_date, end_date, platforms"
    )
    .eq("company_id", companyId)
    .lte("start_date", weekStart)
    .gte("end_date", weekStart);

  if (!data || data.length === 0) {
    return "";
  }

  const lines = data.map(
    (promotion) =>
      `- ${promotion.title}${
        promotion.description ? `: ${promotion.description}` : ""
      }${
        promotion.discount_value ? ` (${promotion.discount_value})` : ""
      }${
        promotion.promo_code ? `, code: ${promotion.promo_code}` : ""
      }, running ${promotion.start_date} to ${promotion.end_date}`
  );

  return `\n\nActive promotions this week -- ensure at least one post concept promotes each of these:\n${lines.join("\n")}`;
}

type CatalogueItem = {
  item_name: string;
  category: string | null;
  price_jmd: number | null;
  description: string | null;
  seasonal: boolean | null;
};

type BusinessHour = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  closed: boolean | null;
};

async function getCatalogueContext(companyId: string): Promise<string> {
  const supabase = createAdminClient();

  // Tables may exist before they are added to generated Database types.
  const catalogueClient = supabase as ReturnType<typeof createAdminClient> & {
    from(table: "business_catalogue"): {
      select(columns: string): {
        eq(column: string, value: string | boolean): {
          eq(column: string, value: string | boolean): {
            order(column: string): {
              limit(count: number): Promise<{ data: CatalogueItem[] | null }>;
            };
          };
        };
      };
    };
    from(table: "business_hours"): {
      select(columns: string): {
        eq(column: string, value: string): Promise<{ data: BusinessHour[] | null }>;
      };
    };
  };

  const { data: items } = await catalogueClient
    .from("business_catalogue")
    .select("item_name, category, price_jmd, description, seasonal")
    .eq("company_id", companyId)
    .eq("available", true)
    .order("category")
    .limit(20);

  const { data: hours } = await catalogueClient
    .from("business_hours")
    .select("day_of_week, open_time, close_time, closed")
    .eq("company_id", companyId);

  let context = "";

  if (items && items.length > 0) {
    const grouped = items.reduce<Record<string, CatalogueItem[]>>((acc, item) => {
      const cat = item.category ?? "General";
      acc[cat] = acc[cat] ?? [];
      acc[cat].push(item);
      return acc;
    }, {});

    const lines = Object.entries(grouped).map(
      ([cat, catItems]) =>
        `${cat}: ${catItems
          .map(
            (i) =>
              `${i.item_name}${
                i.price_jmd
                  ? ` ($${Number(i.price_jmd).toLocaleString()} JMD)`
                  : ""
              }${i.seasonal ? " [seasonal]" : ""}`
          )
          .join(", ")}`
    );
    context += `\n\nMenu / product catalogue:\n${lines.join("\n")}`;
  }

  if (hours && hours.length > 0) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const hourLines = hours
      .sort((a, b) => a.day_of_week - b.day_of_week)
      .map((h) =>
        h.closed
          ? `${days[h.day_of_week]}: closed`
          : `${days[h.day_of_week]}: ${h.open_time} - ${h.close_time}`
      );
    context += `\n\nOpening hours:\n${hourLines.join("\n")}`;
  }

  return context;
}

async function getProductLibraryContext(companyId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: photos } = await supabase
    .from("product_photos")
    .select("id, name, description")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (!photos || photos.length === 0) {
    return "";
  }

  const lines = photos.map(
    (photo) =>
      `- "${photo.name}"${photo.description ? `: ${photo.description}` : ""}`
  );

  return `

Available product photos (real photos the client has uploaded):
${lines.join("\n")}

When writing an image-based concept where one of these specific products should be the hero of the shot, end the concept with:
FEATURE_PRODUCT: [exact product name]

This tells the image generator to use the client's actual product photo as a visual reference when creating the stylized marketing image. The result will look like a professional photo of that real product in a styled scene -- not just a generic stock image.

Only add FEATURE_PRODUCT when the concept is specifically about showcasing that product. Do not add it for lifestyle, atmosphere, behind-the-scenes, or general brand concepts. Add it for roughly 30-40% of image concepts when a product library exists.`;
}

const VOICE_OVER_INSTRUCTIONS = `

For every VIDEO concept, you MUST end with either:
VOICE_OVER: "short script here — max 15 words, conversational, brand voice"
OR
VOICE_OVER: none

Use a voiceover script for AT LEAST 50% of video concepts. Use it when:
- The concept features a specific product or menu item
- The concept is promotional (Father's Day, special offer, new item)
- A human voice would add warmth or urgency
- The concept has a clear message to deliver

Use VOICE_OVER: none only when:
- Pure atmosphere or cinematic mood piece
- Behind-the-scenes with no clear message
- Music-only would be more powerful

Examples:
VOICE_OVER: "Fresh bowls built right. Your way. Every single time."
VOICE_OVER: "Father's Day brunch. Sunday. Nine till three. Come through."
VOICE_OVER: "This is your new office. Free WiFi. Good food. Open late."
VOICE_OVER: none`;

async function getUpcomingHolidaysContext(
  companyId: string,
  demographic: string
): Promise<string> {
  const supabase = createAdminClient();

  const { data: allHolidays } = await supabase
    .from("holidays")
    .select("*")
    .eq("active", true);

  if (!allHolidays || allHolidays.length === 0) {
    return "";
  }

  const { data: companyOverrides } = await supabase
    .from("company_holidays")
    .select("enabled, holiday_id, custom_name")
    .eq("company_id", companyId);

  const disabledIds = new Set(
    companyOverrides
      ?.filter((entry) => !entry.enabled)
      .map((entry) => entry.holiday_id) ?? []
  );

  const customNames = new Map(
    companyOverrides
      ?.filter((entry) => entry.custom_name)
      .map((entry) => [entry.holiday_id, entry.custom_name as string]) ?? []
  );

  const upcoming = getRelevantHolidays(
    allHolidays.filter((holiday) => !disabledIds.has(holiday.id)),
    demographic,
    21
  );

  if (upcoming.length === 0) {
    return "";
  }

  const lines = upcoming.map((holiday) => {
    const name = customNames.get(holiday.id) ?? holiday.name;
    const dateStr = holiday.resolved_date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return `- ${name} (${dateStr})${holiday.description ? `: ${holiday.description}` : ""}`;
  });

  return `

Upcoming occasions in the next 3 weeks -- consider incorporating these naturally into relevant concepts:
${lines.join("\n")}

Do not force every concept to mention an occasion. Only reference an occasion when it genuinely fits the brand and concept. Aim for 1-2 occasion-themed concepts per week when occasions exist.`;
}

function parseFeaturedProductFromConcept(rawConcept: string): {
  cleanConcept: string;
  featuredProductName: string | null;
} {
  const productMatch = rawConcept.match(/FEATURE_PRODUCT:\s*(.+)/i);
  const featuredProductName = productMatch?.[1]?.trim() ?? null;
  const cleanConcept = rawConcept.replace(/FEATURE_PRODUCT:.+/i, "").trim();

  return { cleanConcept, featuredProductName };
}

function parseConceptForInsert(rawConcept: string): {
  cleanConcept: string;
  featuredProductName: string | null;
} {
  const { cleanConcept: afterProduct, featuredProductName } =
    parseFeaturedProductFromConcept(rawConcept);
  const cleanConcept = afterProduct.replace(/VOICE_OVER:.+/i, "").trim();

  return { cleanConcept, featuredProductName };
}

async function resolveFeaturedProductId(
  companyId: string,
  featuredProductName: string | null
): Promise<string | null> {
  if (!featuredProductName) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: match } = await supabase
    .from("product_photos")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", featuredProductName)
    .maybeSingle();

  return match?.id ?? null;
}

export async function generateConcepts(
  companyId: string,
  runId: string,
  trendBrief: TrendBrief,
  weekStart: string,
  overstock?: OverstockIdeationContext | null
): Promise<ConceptResult[]> {
  const brand = await fetchBrandConfig(companyId);
  const anthropic = getAnthropicClient();
  const rejectionSummary = await getRecentRejectionSummary(companyId);
  const promotionsContext = await getActivePromotions(companyId, weekStart);
  const catalogueContext = await getCatalogueContext(companyId);
  const productLibraryContext = await getProductLibraryContext(companyId);
  const profile = parseVisualAudienceProfile(brand.visual_audience_profile);
  const demographicContext = buildIdeationDemographicContext(profile);
  const demographic = profile?.demographic ?? "local";
  const holidaysContext = await getUpcomingHolidaysContext(
    companyId,
    demographic
  );
  const hasOverstock =
    !!overstock && overstock.skus.length > 0 && overstock.postCount > 0;
  const overstockContext = hasOverstock
    ? buildOverstockContext(overstock)
    : "";
  const expectedConceptCount = 7 + (hasOverstock ? overstock.postCount : 0);

  let systemPrompt =
    buildConceptsSystemPrompt(brand) +
    `\n\nAudience demographic context:\n${demographicContext}` +
    promotionsContext +
    catalogueContext;
  console.log("[ideation] product library context:", productLibraryContext);
  systemPrompt += productLibraryContext;
  console.log("[ideation] holidays context:", holidaysContext);
  systemPrompt += holidaysContext;
  if (overstockContext) {
    console.log("[ideation] overstock context:", overstockContext);
    systemPrompt += overstockContext;
  }
  systemPrompt += VOICE_OVER_INSTRUCTIONS;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: overstockContext ? 3000 : 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: buildConceptsUserPrompt(trendBrief, rejectionSummary),
      },
    ],
  });

  if (response.usage) {
    await logCostEvent({
      companyId,
      runId,
      provider: "claude",
      model: CLAUDE_MODEL,
      stepName: "ideation",
      estimatedCostUsd: estimateClaudeCost(
        response.usage.input_tokens,
        response.usage.output_tokens
      ),
    });
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned an empty response.");
  }

  const parsed = parseJsonFromResponse<RawConceptResult[]>(textBlock.text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Claude response was not a valid concept array.");
  }

  const concepts = parsed.map((item, index) => ({
    platform: normalizePlatform(item.platform),
    concept: item.concept.trim(),
    content_type: normalizeContentType(item.content_type),
    content_category: normalizeContentCategory(item.content_category, index),
    suggested_time_tag: normalizeSuggestedTimeTag(item.suggested_time_tag),
    voice_over: item.voice_over ?? null,
  }));

  if (concepts.length !== expectedConceptCount) {
    throw new Error(
      `Expected ${expectedConceptCount} concepts from Claude, received ${concepts.length}.`
    );
  }

  const supabase = createAdminClient();

  // Prompt contracts: first 7 = regular concepts; last postCount = overstock extras.
  const overstockExtraStartIndex = hasOverstock ? 7 : concepts.length;
  const sourceRecommendationId = hasOverstock
    ? (overstock.sourceRecommendationId ?? null)
    : null;

  const postsToInsert = await Promise.all(
    concepts.map(async (item, index) => {
      const { cleanConcept, featuredProductName } =
        parseConceptForInsert(item.concept);
      const featuredProductId = await resolveFeaturedProductId(
        companyId,
        featuredProductName
      );
      const voiceOverScript =
        typeof item.voice_over === "string" &&
        item.voice_over.trim() !== "" &&
        item.voice_over.trim().toLowerCase() !== "none"
          ? item.voice_over.trim()
          : null;

      const isOverstockExtra = index >= overstockExtraStartIndex;
      const overstockRecommendationId =
        isOverstockExtra && sourceRecommendationId
          ? sourceRecommendationId
          : null;

      return {
        company_id: companyId,
        run_id: runId,
        platform: item.platform,
        content_type: item.content_type,
        content_category: item.content_category,
        concept: cleanConcept,
        featured_product_id: featuredProductId,
        voice_over_script: voiceOverScript,
        suggested_time_tag: item.suggested_time_tag,
        gate1_status: "pending",
        gate2_status: "pending",
        pipeline_stage: "ideation",
        hashtags: [],
        overstock_recommendation_id: overstockRecommendationId,
      };
    })
  );

  const { error: insertError } = await supabase.from("posts").insert(postsToInsert);

  if (insertError) {
    throw new Error(`Failed to insert concepts: ${insertError.message}`);
  }

  return concepts.map((item) => {
    const { cleanConcept } = parseConceptForInsert(item.concept);
    return {
      ...item,
      concept: cleanConcept,
    };
  });
}
