import {
  reviewOverstockRecommendation,
  type OverstockAiReviewBrandContext,
} from "@/lib/agents/overstock-review";
import {
  buildSelectionNarrative,
  scoreOverstockCandidates,
  selectTopRecommendations,
  type ScoredOverstockItem,
} from "@/lib/overstock/score";
import { parseStoredOverstockAiReview } from "@/lib/overstock/ai-review-types";
import {
  getLatestRecommendations,
  getOverstockScoringCandidates,
  parseCampaignStrategy,
  type OverstockCampaignStrategy,
  type OverstockRecommendation,
} from "@/lib/queries/overstock";
import { createAdminClient } from "@/lib/supabase/server";

const SOURCE_TYPE_SCORE = "overstock_score";
const SOURCE_TYPE_MANUAL_QUEUE = "manual_queue";
const STATUS_RECOMMENDED = "recommended";
const STATUS_APPROVED = "approved";
const STATUS_QUEUED = "queued";
const DEFAULT_REC_POST_COUNT = 1;

export class OverstockApproveError extends Error {
  readonly code: "not_found" | "invalid_state" | "already_queued";

  constructor(
    message: string,
    code: "not_found" | "invalid_state" | "already_queued"
  ) {
    super(message);
    this.name = "OverstockApproveError";
    this.code = code;
  }
}

export type ApproveOverstockResult = {
  queuedSelectionId: string;
  recommendation: OverstockRecommendation;
  warning?: string;
};

const QUEUE_SUPERSEDE_WARNING =
  "another selection was already queued and will be superseded as latest";

function strategyFromAiReview(
  aiReview: unknown
): OverstockCampaignStrategy | null {
  const parsed = parseStoredOverstockAiReview(aiReview);
  if (!parsed) {
    return parseCampaignStrategy(aiReview);
  }
  return {
    campaign_angle: parsed.campaign_angle,
    target_audience: parsed.target_audience,
    customer_problem: parsed.customer_problem,
    narrative: parsed.narrative,
  };
}

function mapRecommendationRow(row: {
  id: string;
  skus: string[] | null;
  opportunity_score: number | null;
  rank: number | null;
  product_group: string | null;
  selection_reason: string | null;
  eligibility_status: string | null;
  inventory_snapshot: unknown;
  analysis_generated_at: string | null;
  ai_review: unknown;
  status?: string | null;
  consumed_by_run_id?: string | null;
}): OverstockRecommendation {
  const snapshot =
    row.inventory_snapshot &&
    typeof row.inventory_snapshot === "object" &&
    !Array.isArray(row.inventory_snapshot)
      ? (row.inventory_snapshot as Record<string, unknown>)
      : null;
  const productName =
    snapshot && typeof snapshot.product_name === "string"
      ? snapshot.product_name
      : "";

  return {
    id: row.id,
    skus: Array.isArray(row.skus) ? row.skus : [],
    product_name: productName,
    opportunity_score: Number(row.opportunity_score ?? 0),
    rank: Number(row.rank ?? 0),
    product_group: row.product_group ?? "(blank)",
    selection_reason: row.selection_reason ?? "",
    eligibility_status: row.eligibility_status ?? "eligible",
    inventory_snapshot: snapshot,
    analysis_generated_at: row.analysis_generated_at ?? "",
    ai_review: parseStoredOverstockAiReview(row.ai_review),
    status: row.status ?? "recommended",
    consumed_by_run_id: row.consumed_by_run_id ?? null,
  };
}

/**
 * Approve a scored recommendation: status → approved (score/rank untouched),
 * then inject an enriched manual_queue row for the existing ideation pipeline.
 */
export async function approveOverstockRecommendation(
  recommendationId: string,
  companyId: string,
  approverEmail?: string | null,
  postCount?: number
): Promise<ApproveOverstockResult> {
  const resolvedPostCount =
    postCount === undefined || postCount === null
      ? DEFAULT_REC_POST_COUNT
      : postCount;

  if (
    !Number.isFinite(resolvedPostCount) ||
    resolvedPostCount < 1 ||
    resolvedPostCount > 20
  ) {
    throw new OverstockApproveError(
      "post_count must be between 1 and 20.",
      "invalid_state"
    );
  }

  const admin = createAdminClient();

  const { data: recommendation, error: loadError } = await admin
    .from("overstock_selections")
    .select(
      "id, company_id, skus, post_count, status, source_type, opportunity_score, rank, product_group, selection_reason, eligibility_status, inventory_snapshot, analysis_generated_at, ai_review, consumed_by_run_id"
    )
    .eq("id", recommendationId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load recommendation: ${loadError.message}`);
  }

  if (!recommendation) {
    throw new OverstockApproveError(
      "Overstock recommendation not found.",
      "not_found"
    );
  }

  if (recommendation.source_type !== SOURCE_TYPE_SCORE) {
    throw new OverstockApproveError(
      "Only scored overstock recommendations can be approved.",
      "invalid_state"
    );
  }

  if (recommendation.status !== STATUS_RECOMMENDED) {
    throw new OverstockApproveError(
      `Recommendation is already '${recommendation.status}' and cannot be approved again.`,
      "invalid_state"
    );
  }

  const { data: existingLinkedQueue, error: linkedError } = await admin
    .from("overstock_selections")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_type", SOURCE_TYPE_MANUAL_QUEUE)
    .eq("status", STATUS_QUEUED)
    .eq("source_recommendation_id", recommendationId)
    .limit(1)
    .maybeSingle();

  if (linkedError) {
    throw new Error(
      `Failed to check existing linked queue: ${linkedError.message}`
    );
  }

  if (existingLinkedQueue) {
    throw new OverstockApproveError(
      "This recommendation already has a queued selection pending content generation.",
      "already_queued"
    );
  }

  const { data: otherQueued, error: otherQueuedError } = await admin
    .from("overstock_selections")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_type", SOURCE_TYPE_MANUAL_QUEUE)
    .eq("status", STATUS_QUEUED)
    .limit(1)
    .maybeSingle();

  if (otherQueuedError) {
    throw new Error(
      `Failed to check pending manual queue: ${otherQueuedError.message}`
    );
  }

  const warning = otherQueued ? QUEUE_SUPERSEDE_WARNING : undefined;

  const skus = Array.isArray(recommendation.skus) ? recommendation.skus : [];
  if (skus.length === 0) {
    throw new OverstockApproveError(
      "Recommendation has no SKUs to queue.",
      "invalid_state"
    );
  }

  const campaignStrategy = strategyFromAiReview(recommendation.ai_review);

  const { error: approveError } = await admin
    .from("overstock_selections")
    .update({ status: STATUS_APPROVED })
    .eq("id", recommendationId)
    .eq("company_id", companyId)
    .eq("status", STATUS_RECOMMENDED)
    .eq("source_type", SOURCE_TYPE_SCORE);

  if (approveError) {
    throw new Error(
      `Failed to approve recommendation: ${approveError.message}`
    );
  }

  const { data: queued, error: insertError } = await admin
    .from("overstock_selections")
    .insert({
      company_id: companyId,
      skus,
      post_count: resolvedPostCount,
      status: STATUS_QUEUED,
      source_type: SOURCE_TYPE_MANUAL_QUEUE,
      created_by_email: approverEmail ?? null,
      source_recommendation_id: recommendationId,
      campaign_strategy: campaignStrategy,
    })
    .select("id")
    .single();

  if (insertError || !queued) {
    throw new Error(
      insertError?.message ?? "Failed to queue approved recommendation."
    );
  }

  return {
    queuedSelectionId: queued.id,
    recommendation: mapRecommendationRow({
      ...recommendation,
      status: STATUS_APPROVED,
      consumed_by_run_id: recommendation.consumed_by_run_id ?? null,
    }),
    ...(warning ? { warning } : {}),
  };
}

function buildInventorySnapshot(
  item: ScoredOverstockItem
): Record<string, unknown> {
  return {
    sku: item.sku,
    product_name: item.product_name,
    category: item.category,
    excess_value_local: item.excess_value_local,
    excess_units: item.excess_units,
    months_of_cover: item.months_of_cover,
    quantity_available: item.quantity_available,
    annual_demand_units: item.annual_demand_units,
    avg_monthly_last_3m: item.avg_monthly_last_3m,
    units_sold_last_30d: item.units_sold_last_30d,
  };
}

function snapshotNumber(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number
): number {
  const value = snapshot?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function snapshotNullableNumber(
  snapshot: Record<string, unknown> | null | undefined,
  key: string
): number | null {
  const value = snapshot?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function fetchBrandContext(
  companyId: string
): Promise<OverstockAiReviewBrandContext | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_configs")
    .select("tone, target_audience, unique_selling_point, brand_voice_doc")
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    console.warn(
      `[overstock-analysis] Brand config unavailable for AI review: ${
        error?.message ?? "not found"
      }`
    );
    return null;
  }

  return {
    tone: data.tone,
    target_audience: data.target_audience,
    unique_selling_point: data.unique_selling_point,
    brand_voice_doc: data.brand_voice_doc,
  };
}

type PersistableRecommendation = {
  item: ScoredOverstockItem;
  rank: number;
  eligibility_status: "eligible" | "alternate";
};

type InsertedRecommendationRow = {
  id: string;
  eligibility_status: string | null;
  skus: string[] | null;
  opportunity_score: number | null;
  rank: number | null;
  product_group: string | null;
  selection_reason: string | null;
  inventory_snapshot: Record<string, unknown> | null;
};

/**
 * Enrich eligible (top-3) rows with AI review. Writes ai_review only — never
 * rank / opportunity_score / skus / score_breakdown.
 */
async function enrichEligibleWithAiReview(
  companyId: string,
  insertedRows: InsertedRecommendationRow[]
): Promise<void> {
  const eligible = insertedRows.filter(
    (row) => row.eligibility_status === "eligible"
  );
  if (eligible.length === 0) {
    return;
  }

  const brand = await fetchBrandContext(companyId);
  if (!brand) {
    return;
  }

  const admin = createAdminClient();

  await Promise.all(
    eligible.map(async (row) => {
      const snapshot = row.inventory_snapshot;
      const sku = Array.isArray(row.skus) && row.skus[0] ? row.skus[0] : "";
      const productName =
        snapshot && typeof snapshot.product_name === "string"
          ? snapshot.product_name
          : "";
      const category =
        snapshot && typeof snapshot.category === "string"
          ? snapshot.category
          : null;

      const review = await reviewOverstockRecommendation({
        companyId,
        product_name: productName,
        sku,
        category,
        product_group: row.product_group ?? "(blank)",
        opportunity_score:
          typeof row.opportunity_score === "number"
            ? row.opportunity_score
            : Number(row.opportunity_score) || 0,
        rank: typeof row.rank === "number" ? row.rank : Number(row.rank) || 0,
        selection_reason: row.selection_reason ?? "",
        excess_value_local: snapshotNumber(snapshot, "excess_value_local", 0),
        excess_units: snapshotNumber(snapshot, "excess_units", 0),
        months_of_cover: snapshotNumber(snapshot, "months_of_cover", 0),
        quantity_available: snapshotNumber(snapshot, "quantity_available", 0),
        annual_demand_units: snapshotNumber(snapshot, "annual_demand_units", 0),
        avg_monthly_last_3m: snapshotNullableNumber(
          snapshot,
          "avg_monthly_last_3m"
        ),
        units_sold_last_30d: snapshotNullableNumber(
          snapshot,
          "units_sold_last_30d"
        ),
        brand,
      });

      if (!review) {
        return;
      }

      // Structural non-rerank: update set contains only ai_review.
      const { error } = await admin
        .from("overstock_selections")
        .update({ ai_review: review })
        .eq("id", row.id);

      if (error) {
        console.warn(
          `[overstock-analysis] Failed to persist ai_review for ${row.id}: ${error.message}`
        );
      }
    })
  );
}

/**
 * Score eligible overstock, persist a new recommendation batch to ads only.
 * History-keeping: inserts a new batch; never deletes prior analyses.
 * Then optionally enriches top-3 eligible rows with AI review (ads UPDATE only).
 */
export async function runOverstockAnalysis(
  companyId: string,
  generatedByEmail?: string | null
): Promise<OverstockRecommendation[]> {
  const candidates = await getOverstockScoringCandidates(companyId);
  const scored = scoreOverstockCandidates(candidates);
  const top = selectTopRecommendations(scored, 3);

  const analysisGeneratedAt = new Date().toISOString();
  const toPersist: PersistableRecommendation[] = [
    ...top.selected.map((item, index) => ({
      item,
      rank: index + 1,
      eligibility_status: "eligible" as const,
    })),
    ...top.alternates.map((item, index) => ({
      item,
      rank: top.selected.length + index + 1,
      eligibility_status: "alternate" as const,
    })),
  ];

  if (toPersist.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const rows = toPersist.map(({ item, rank, eligibility_status }) => ({
    company_id: companyId,
    skus: [item.sku],
    post_count: DEFAULT_REC_POST_COUNT,
    status: STATUS_RECOMMENDED,
    source_type: SOURCE_TYPE_SCORE,
    opportunity_score: item.opportunity_score,
    score_breakdown: item.score_breakdown,
    rank,
    product_group: item.product_group,
    selection_reason: buildSelectionNarrative(item),
    eligibility_status,
    inventory_snapshot: buildInventorySnapshot(item),
    analysis_generated_at: analysisGeneratedAt,
    created_by_email: generatedByEmail ?? null,
  }));

  const { data: inserted, error } = await admin
    .from("overstock_selections")
    .insert(rows)
    .select(
      "id, eligibility_status, skus, opportunity_score, rank, product_group, selection_reason, inventory_snapshot"
    );

  if (error) {
    throw new Error(`Failed to persist overstock analysis: ${error.message}`);
  }

  const insertedRows = (inserted ?? []) as InsertedRecommendationRow[];

  try {
    await enrichEligibleWithAiReview(companyId, insertedRows);
  } catch (enrichError) {
    const message =
      enrichError instanceof Error
        ? enrichError.message
        : "Unknown AI enrichment error";
    console.warn(
      `[overstock-analysis] AI enrichment failed; deterministic rows kept: ${message}`
    );
  }

  return getLatestRecommendations(companyId);
}
