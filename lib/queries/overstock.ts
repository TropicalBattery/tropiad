import type { OverstockAiReview } from "@/lib/overstock/ai-review-types";
import { parseStoredOverstockAiReview } from "@/lib/overstock/ai-review-types";
import { getSingleCompanyId } from "@/lib/config/single-company";
import type { ScoringCandidate } from "@/lib/overstock/score";
import { createAdminClient } from "@/lib/supabase/server";

const OVERSTOCK_TENANT_ID = "tropical-battery";
const DAYS_PER_MONTH = 30.44;
const OVERSTOCK_MONTHS = 6;
const MAX_DAYS_SINCE_LAST_SALE = 90;
const PAGE_SIZE = 1000;
/** Inclusive .range() end for a single velocity fetch (~6541 SKUs). */
const VELOCITY_SINGLE_FETCH_TO = 9999;

type AdminClient = ReturnType<typeof createAdminClient>;

/** Untyped public reader for relations not present in generated Database types. */
type UntypedPublicQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      range: (
        from: number,
        to: number
      ) => PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type UntypedPublicClient = {
  from: (relation: string) => UntypedPublicQuery;
};

export type OverstockItem = {
  sku: string;
  product_name: string;
  quantity_available: number;
  months_of_cover: number;
  excess_units: number;
  excess_value_local: number;
};

export type OverstockCampaignStrategy = {
  campaign_angle: string;
  target_audience: string;
  customer_problem: string;
  narrative: string;
};

export type QueuedOverstockSelection = {
  id: string;
  skus: string[];
  post_count: number;
  created_at: string;
  source_recommendation_id: string | null;
  campaign_strategy: OverstockCampaignStrategy | null;
};

export type OverstockRecommendation = {
  id: string;
  skus: string[];
  product_name: string;
  opportunity_score: number;
  rank: number;
  product_group: string;
  selection_reason: string;
  eligibility_status: string;
  inventory_snapshot: Record<string, unknown> | null;
  analysis_generated_at: string;
  ai_review: OverstockAiReview | null;
  /** Lifecycle: recommended → approved → (queue) → consumed stamped on parent. */
  status: string;
  /** Set when content run consumed the linked queue row. */
  consumed_by_run_id: string | null;
};

type ProductRow = {
  sku: string | null;
  name: string | null;
  external_id: string | null;
  category: string | null;
};

type InventoryRow = {
  sku: string | null;
  quantity_on_hand: number | string | null;
  quantity_available: number | string | null;
  quantity_in_transit: number | string | null;
  quantity_in_bond: number | string | null;
  quantity_at_port: number | string | null;
  quantity_in_clearing: number | string | null;
};

type CostingRow = {
  sku: string | null;
  product_external_id: string | null;
  annual_demand_units: number | string | null;
  avg_daily_demand_units: number | string | null;
  current_cost_local: number | string | null;
  source_updated_at: string | null;
};

type PurchaseRuleRow = {
  sku: string | null;
  rule_type: string | null;
};

type SalesVelocityRow = {
  sku: string | null;
  days_since_last_sale: number | string | null;
  units_sold_last_30d: number | string | null;
  avg_monthly_last_3m: number | string | null;
};

type VelocityBySku = {
  days_since_last_sale: number | null;
  units_sold_last_30d: number | null;
  avg_monthly_last_3m: number | null;
};

function untypedPublicClient(admin: AdminClient): UntypedPublicClient {
  return admin.schema("public") as unknown as UntypedPublicClient;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPositive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseCampaignStrategy(
  value: unknown
): OverstockCampaignStrategy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const campaign_angle =
    typeof record.campaign_angle === "string" ? record.campaign_angle : "";
  const target_audience =
    typeof record.target_audience === "string" ? record.target_audience : "";
  const customer_problem =
    typeof record.customer_problem === "string" ? record.customer_problem : "";
  const narrative = typeof record.narrative === "string" ? record.narrative : "";
  if (!campaign_angle && !target_audience && !customer_problem && !narrative) {
    return null;
  }
  return {
    campaign_angle,
    target_audience,
    customer_problem,
    narrative,
  };
}

async function fetchAllPublicRows<T>(
  admin: AdminClient,
  table: "products" | "mv_inventory_aggregates_by_sku" | "item_costing",
  select: string
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  const publicDb = admin.schema("public");

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const query =
      table === "products"
        ? publicDb.from("products").select(select)
        : table === "item_costing"
          ? publicDb.from("item_costing").select(select)
          : publicDb.from("mv_inventory_aggregates_by_sku").select(select);

    const { data, error } = await query
      .eq("tenant_id", OVERSTOCK_TENANT_ID)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to read public.${table}: ${error.message}`);
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

/** Paged read for small untyped public tables (e.g. item_purchase_rules ~1.7k rows). */
async function fetchAllUntypedPublicRows<T>(
  admin: AdminClient,
  relation: string,
  select: string
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  const publicDb = untypedPublicClient(admin);

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await publicDb
      .from(relation)
      .select(select)
      .eq("tenant_id", OVERSTOCK_TENANT_ID)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to read public.${relation}: ${error.message}`);
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * vw_sales_velocity aggregates sales_transactions live. Paging at PAGE_SIZE
 * re-runs that aggregate per page (~7x). Prefer one bulk select of the narrow
 * columns covering the full catalogue (~6541 rows).
 */
async function fetchSalesVelocityOnce(
  admin: AdminClient
): Promise<SalesVelocityRow[]> {
  const publicDb = untypedPublicClient(admin);
  const velocitySelect =
    "sku, days_since_last_sale, units_sold_last_30d, avg_monthly_last_3m";
  const { data, error } = await publicDb
    .from("vw_sales_velocity")
    .select(velocitySelect)
    .eq("tenant_id", OVERSTOCK_TENANT_ID)
    .range(0, VELOCITY_SINGLE_FETCH_TO);

  if (error) {
    throw new Error(
      `Failed to read public.vw_sales_velocity: ${error.message}`
    );
  }

  const firstPage = (data ?? []) as SalesVelocityRow[];

  // Full catalogue fits when under the requested ceiling and not truncated at
  // the common PostgREST 1000-row max_rows default.
  if (firstPage.length !== PAGE_SIZE) {
    return firstPage;
  }

  // Hard 1000-row cap: page the remainder (each page re-aggregates; prefer
  // raising PostgREST max_rows if this path is hit regularly).
  const rows: SalesVelocityRow[] = [...firstPage];
  let from = PAGE_SIZE;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data: pageData, error: pageError } = await publicDb
      .from("vw_sales_velocity")
      .select(velocitySelect)
      .eq("tenant_id", OVERSTOCK_TENANT_ID)
      .range(from, to);

    if (pageError) {
      throw new Error(
        `Failed to read public.vw_sales_velocity: ${pageError.message}`
      );
    }

    const page = (pageData ?? []) as SalesVelocityRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * Shared Phase-0-eligible overstock rows (read-only public).
 * Does NOT apply the scorer's trickle floor (12/60) — that stays in score.ts.
 */
async function loadEligibleOverstockCandidates(): Promise<ScoringCandidate[]> {
  const admin = createAdminClient();

  // products.category is live but missing from generated Database types — untyped read.
  const [products, inventory, costing, purchaseRules, velocityRows] =
    await Promise.all([
      fetchAllUntypedPublicRows<ProductRow>(
        admin,
        "products",
        "sku, name, external_id, category"
      ),
      fetchAllPublicRows<InventoryRow>(
        admin,
        "mv_inventory_aggregates_by_sku",
        "sku, quantity_on_hand, quantity_available, quantity_in_transit, quantity_in_bond, quantity_at_port, quantity_in_clearing"
      ),
      fetchAllPublicRows<CostingRow>(
        admin,
        "item_costing",
        "sku, product_external_id, annual_demand_units, avg_daily_demand_units, current_cost_local, source_updated_at"
      ),
      fetchAllUntypedPublicRows<PurchaseRuleRow>(
        admin,
        "item_purchase_rules",
        "sku, rule_type"
      ),
      fetchSalesVelocityOnce(admin),
    ]);

  const excludedSkus = new Set<string>();
  for (const row of purchaseRules) {
    if (
      row.sku &&
      (row.rule_type === "discontinue" || row.rule_type === "do_not_buy")
    ) {
      excludedSkus.add(row.sku);
    }
  }

  const velocityBySku = new Map<string, VelocityBySku>();
  for (const row of velocityRows) {
    if (row.sku) {
      velocityBySku.set(row.sku, {
        days_since_last_sale: toNullableNumber(row.days_since_last_sale),
        units_sold_last_30d: toNullableNumber(row.units_sold_last_30d),
        avg_monthly_last_3m: toNullableNumber(row.avg_monthly_last_3m),
      });
    }
  }

  const inventoryBySku = new Map<string, InventoryRow>();
  for (const row of inventory) {
    if (row.sku) {
      inventoryBySku.set(row.sku, row);
    }
  }

  const costingBySku = new Map<string, CostingRow>();
  const costingByExternalId = new Map<string, CostingRow>();
  for (const row of costing) {
    if (row.sku) {
      const current = costingBySku.get(row.sku);
      if (
        !current ||
        parseTimestamp(row.source_updated_at) >
          parseTimestamp(current.source_updated_at)
      ) {
        costingBySku.set(row.sku, row);
      }
    }
    if (row.product_external_id) {
      const current = costingByExternalId.get(row.product_external_id);
      if (
        !current ||
        parseTimestamp(row.source_updated_at) >
          parseTimestamp(current.source_updated_at)
      ) {
        costingByExternalId.set(row.product_external_id, row);
      }
    }
  }

  const candidates: ScoringCandidate[] = [];

  for (const product of products) {
    if (!product.sku) {
      continue;
    }

    const inv = inventoryBySku.get(product.sku);
    const cost =
      costingBySku.get(product.sku) ??
      (product.external_id
        ? costingByExternalId.get(product.external_id)
        : undefined);

    const annualDemand = toNullableNumber(cost?.annual_demand_units);
    // Matches view / app "no_demand" gate: require positive annual demand.
    if (!isPositive(annualDemand)) {
      continue;
    }

    // Phase 0 medium eligibility: skip discontinue / do_not_buy (not vendor_lock).
    if (excludedSkus.has(product.sku)) {
      continue;
    }

    const velocity = velocityBySku.get(product.sku);
    const daysSinceLastSale = velocity?.days_since_last_sale ?? null;
    // Require a sale within MAX_DAYS_SINCE_LAST_SALE; null/missing = never sold.
    if (
      daysSinceLastSale == null ||
      daysSinceLastSale > MAX_DAYS_SINCE_LAST_SALE
    ) {
      continue;
    }

    const avgDailyDemand = toNullableNumber(cost?.avg_daily_demand_units);
    const unitCost = toNullableNumber(cost?.current_cost_local);

    const quantityOnHand = toNumber(inv?.quantity_on_hand);
    const quantityAvailable = toNumber(inv?.quantity_available);
    const quantityAllocated = quantityOnHand - quantityAvailable;
    const quantityInPipeline =
      toNumber(inv?.quantity_in_transit) +
      toNumber(inv?.quantity_in_bond) +
      toNumber(inv?.quantity_at_port) +
      toNumber(inv?.quantity_in_clearing);

    const stockPosition =
      quantityOnHand - quantityAllocated + quantityInPipeline;

    const avgMonthlyDemand = isPositive(annualDemand)
      ? annualDemand / 12
      : isPositive(avgDailyDemand)
        ? avgDailyDemand * DAYS_PER_MONTH
        : null;

    if (!isPositive(avgMonthlyDemand)) {
      continue;
    }

    const monthsOfCover = stockPosition / avgMonthlyDemand;
    if (!Number.isFinite(monthsOfCover) || !(monthsOfCover > OVERSTOCK_MONTHS)) {
      continue;
    }

    const excessUnits = Math.max(
      0,
      stockPosition - avgMonthlyDemand * OVERSTOCK_MONTHS
    );
    const excessValue =
      isPositive(unitCost) && Number.isFinite(excessUnits)
        ? excessUnits * unitCost
        : 0;

    candidates.push({
      sku: product.sku,
      product_name: product.name ?? "",
      category: product.category?.trim() ? product.category.trim() : null,
      quantity_available: quantityAvailable,
      months_of_cover: monthsOfCover,
      excess_units: excessUnits,
      excess_value_local: excessValue,
      annual_demand_units: annualDemand,
      avg_monthly_last_3m: velocity?.avg_monthly_last_3m ?? null,
      units_sold_last_30d: velocity?.units_sold_last_30d ?? null,
    });
  }

  return candidates;
}

/**
 * Overstock list for Tropical Battery.
 *
 * public.vw_overstock times out (it scans vw_reorder_inputs). This path
 * replicates the same formulas against the underlying fast tables:
 * products + mv_inventory_aggregates_by_sku + item_costing.
 * Phase 0 adds read-only eligibility filters from item_purchase_rules and
 * vw_sales_velocity (no formula changes).
 */
export async function getOverstockItems(): Promise<OverstockItem[]> {
  const candidates = await loadEligibleOverstockCandidates();

  const items: OverstockItem[] = candidates.map((candidate) => ({
    sku: candidate.sku,
    product_name: candidate.product_name,
    quantity_available: candidate.quantity_available,
    months_of_cover: candidate.months_of_cover,
    excess_units: candidate.excess_units,
    excess_value_local: candidate.excess_value_local,
  }));

  items.sort((left, right) => {
    if (right.excess_value_local !== left.excess_value_local) {
      return right.excess_value_local - left.excess_value_local;
    }
    return left.sku.localeCompare(right.sku);
  });

  return items;
}

/**
 * Scoring candidates for Phase 1 (same Phase-0 eligibility as getOverstockItems).
 * Trickle floor (demand ≥ 12 / MoC ≤ 60) is applied by scoreOverstockCandidates.
 */
export async function getOverstockScoringCandidates(
  companyId: string
): Promise<ScoringCandidate[]> {
  // Single-tenant inventory reads; companyId reserved for multi-tenant later.
  void companyId;
  return loadEligibleOverstockCandidates();
}

/**
 * Writes a queued selection into ads.overstock_selections (default schema).
 */
export async function queueOverstockSelection(
  skus: string[],
  postCount: number,
  email: string | null
): Promise<string> {
  if (skus.length === 0) {
    throw new Error("At least one SKU is required.");
  }
  if (!Number.isFinite(postCount) || postCount < 1 || postCount > 20) {
    throw new Error("post_count must be between 1 and 20.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("overstock_selections")
    .insert({
      company_id: getSingleCompanyId(),
      skus,
      post_count: postCount,
      created_by_email: email,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Failed to queue overstock selection."
    );
  }

  return data.id;
}

/**
 * Latest queued batch for a company (banner / ideation consume the same row).
 * Isolated from scored recommendations via status + source_type.
 */
export async function getLatestQueuedSelection(
  companyId: string
): Promise<QueuedOverstockSelection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("overstock_selections")
    .select(
      "id, skus, post_count, created_at, source_recommendation_id, campaign_strategy"
    )
    .eq("company_id", companyId)
    .eq("status", "queued")
    .eq("source_type", "manual_queue")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load queued selection: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    skus: Array.isArray(data.skus) ? data.skus : [],
    post_count: toNumber(data.post_count),
    created_at: data.created_at,
    source_recommendation_id: data.source_recommendation_id ?? null,
    campaign_strategy: parseCampaignStrategy(data.campaign_strategy),
  };
}

/** Single-tenant convenience wrapper around getLatestQueuedSelection. */
export async function getQueuedSelection(): Promise<QueuedOverstockSelection | null> {
  return getLatestQueuedSelection(getSingleCompanyId());
}

/**
 * Resolve product display names for SKUs from public.products (same source as
 * getOverstockItems). Returns names aligned with the input sku order; missing
 * names are empty strings.
 */
export async function resolveProductNamesForSkus(
  skus: string[]
): Promise<string[]> {
  if (skus.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("public")
    .from("products")
    .select("sku, name")
    .eq("tenant_id", OVERSTOCK_TENANT_ID)
    .in("sku", skus);

  if (error) {
    throw new Error(`Failed to resolve product names: ${error.message}`);
  }

  const nameBySku = new Map<string, string>();
  for (const row of (data ?? []) as Array<{
    sku: string | null;
    name: string | null;
  }>) {
    if (row.sku) {
      nameBySku.set(row.sku, row.name ?? "");
    }
  }

  return skus.map((sku) => nameBySku.get(sku) ?? "");
}

/**
 * Mark a queued selection consumed by a content run. Idempotent-safe: only
 * updates rows that are still status = 'queued'.
 * When the queue was spawned from an approved recommendation, also stamps
 * consumed_by_run_id on that parent recommendation (score/rank untouched).
 */
export async function markOverstockConsumed(
  selectionId: string,
  runId: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: queueRow, error: loadError } = await admin
    .from("overstock_selections")
    .select("id, source_recommendation_id, status")
    .eq("id", selectionId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load overstock selection: ${loadError.message}`);
  }

  const { error } = await admin
    .from("overstock_selections")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      consumed_by_run_id: runId,
    })
    .eq("id", selectionId)
    .eq("status", "queued");

  if (error) {
    throw new Error(`Failed to mark overstock consumed: ${error.message}`);
  }

  const parentId = queueRow?.source_recommendation_id ?? null;
  if (parentId) {
    const { error: parentError } = await admin
      .from("overstock_selections")
      .update({
        consumed_by_run_id: runId,
        consumed_at: new Date().toISOString(),
      })
      .eq("id", parentId)
      .eq("source_type", "overstock_score");

    if (parentError) {
      console.warn(
        `[overstock] Failed to stamp parent recommendation ${parentId}: ${parentError.message}`
      );
    }
  }
}

export async function cancelQueuedSelection(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("overstock_selections")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("company_id", getSingleCompanyId())
    .eq("status", "queued");

  if (error) {
    throw new Error(`Failed to cancel queued selection: ${error.message}`);
  }
}

/**
 * Latest scored recommendation batch for a company (ads read only).
 */
export async function getLatestRecommendations(
  companyId: string
): Promise<OverstockRecommendation[]> {
  const admin = createAdminClient();

  const { data: latestMeta, error: latestError } = await admin
    .from("overstock_selections")
    .select("analysis_generated_at")
    .eq("company_id", companyId)
    .eq("source_type", "overstock_score")
    .not("analysis_generated_at", "is", null)
    .order("analysis_generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(
      `Failed to load latest analysis timestamp: ${latestError.message}`
    );
  }

  const analysisGeneratedAt = latestMeta?.analysis_generated_at ?? null;
  if (!analysisGeneratedAt) {
    return [];
  }

  const { data, error } = await admin
    .from("overstock_selections")
    .select(
      "id, skus, opportunity_score, rank, product_group, selection_reason, eligibility_status, inventory_snapshot, analysis_generated_at, ai_review, status, consumed_by_run_id"
    )
    .eq("company_id", companyId)
    .eq("source_type", "overstock_score")
    .eq("analysis_generated_at", analysisGeneratedAt)
    .order("rank", { ascending: true });

  if (error) {
    throw new Error(`Failed to load recommendations: ${error.message}`);
  }

  return (data ?? []).map((row) => {
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
      opportunity_score: toNumber(row.opportunity_score),
      rank: toNumber(row.rank),
      product_group: row.product_group ?? "(blank)",
      selection_reason: row.selection_reason ?? "",
      eligibility_status: row.eligibility_status ?? "eligible",
      inventory_snapshot: snapshot,
      analysis_generated_at: row.analysis_generated_at ?? analysisGeneratedAt,
      ai_review: parseStoredOverstockAiReview(row.ai_review),
      status: row.status ?? "recommended",
      consumed_by_run_id: row.consumed_by_run_id ?? null,
    };
  });
}
