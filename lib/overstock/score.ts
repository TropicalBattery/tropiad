/**
 * Deterministic Overstock Advertising Opportunity Score.
 *
 * Pure module: no DB, network, AI, Date.now, or randomness.
 * Consumes already-read inventory fields; does not recompute MoC / excess.
 *
 * Scoring model
 * -------------
 * Floor (applied first):
 *   - annual_demand_units >= MIN_ANNUAL_DEMAND_UNITS (12 ≈ 1 unit/month, ~p10)
 *   - months_of_cover <= MAX_MONTHS_OF_COVER (60 cuts absurd MoC tail; keeps >6 overstock)
 *   Expected ~145 survivors from ~244 Phase-0-eligible candidates.
 *
 * Factors (weights sum to 1.0), each normalized to [0, 1] on the filtered set:
 *   - excess_value   0.35  log1p → min-max  (capital tied up)
 *   - excess_units   0.15  log1p → min-max  (quantity to move)
 *   - velocity       0.30  log1p → min-max  (avg_monthly_last_3m, else 30d units, else 0)
 *   - months_of_cover 0.20 min-max within [6, 60] band (overstock pressure)
 *
 * opportunity_score = round(100 * Σ weight_i * norm_i), clamped to [0, 100].
 * score_breakdown stores each factor's pre-weight normalized 0–1 value.
 *
 * When a factor's min === max across the set, every candidate gets 0.5 for that
 * factor (no discrimination → midpoint; avoids NaN/0 collapse).
 */

/** Exclude SKUs with less than ~1 unit/month of annualised demand (~p10). */
export const MIN_ANNUAL_DEMAND_UNITS = 12;

/**
 * Cap MoC for eligibility and for the MoC score band.
 * Genuine overstock is still >6 months; absurd tails (100s–100000s) are dropped.
 */
export const MAX_MONTHS_OF_COVER = 60;

/** Lower edge of the MoC scoring band (matches overstock gate MoC > 6). */
const MOC_SCORE_BAND_MIN = 6;

/** Capital tied up — primary advertising opportunity signal. */
const WEIGHT_EXCESS_VALUE = 0.35;

/** Volume to clear — secondary quantity signal. */
const WEIGHT_EXCESS_UNITS = 0.15;

/** Recent movement — advertisability / real demand. */
const WEIGHT_VELOCITY = 0.3;

/** How stuck stock is within the [6, 60] band. */
const WEIGHT_MONTHS_OF_COVER = 0.2;

/** Midpoint when a factor has zero range (all values equal). */
const EQUAL_RANGE_NORM = 0.5;

const DEFAULT_TOP_COUNT = 3;
const DEFAULT_ALTERNATE_COUNT = 3;

export type ScoringCandidate = {
  sku: string;
  product_name: string;
  category: string | null;
  quantity_available: number;
  months_of_cover: number;
  excess_units: number;
  excess_value_local: number;
  annual_demand_units: number;
  avg_monthly_last_3m: number | null;
  units_sold_last_30d: number | null;
};

export type ScoredOverstockItem = ScoringCandidate & {
  opportunity_score: number;
  score_breakdown: Record<string, number>;
  rank: number;
  product_group: string;
};

export type TopRecommendationsResult = {
  selected: ScoredOverstockItem[];
  alternates: ScoredOverstockItem[];
};

function productGroupFromCategory(category: string | null): string {
  const trimmed = category?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "(blank)";
}

function passesTrickleFloor(candidate: ScoringCandidate): boolean {
  return (
    candidate.annual_demand_units >= MIN_ANNUAL_DEMAND_UNITS &&
    candidate.months_of_cover <= MAX_MONTHS_OF_COVER
  );
}

function velocityRaw(candidate: ScoringCandidate): number {
  if (
    candidate.avg_monthly_last_3m !== null &&
    Number.isFinite(candidate.avg_monthly_last_3m)
  ) {
    return Math.max(0, candidate.avg_monthly_last_3m);
  }
  if (
    candidate.units_sold_last_30d !== null &&
    Number.isFinite(candidate.units_sold_last_30d)
  ) {
    return Math.max(0, candidate.units_sold_last_30d);
  }
  return 0;
}

function safeLog1p(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.log1p(value);
}

/**
 * Min-max normalize. When min === max, assign EQUAL_RANGE_NORM (0.5) so every
 * candidate gets a neutral mid score instead of 0 or NaN.
 */
function minMaxNorm(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return EQUAL_RANGE_NORM;
  }
  if (max === min) {
    return EQUAL_RANGE_NORM;
  }
  const norm = (value - min) / (max - min);
  if (!Number.isFinite(norm)) {
    return EQUAL_RANGE_NORM;
  }
  return Math.min(1, Math.max(0, norm));
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function compareScoreThenSku(
  left: ScoredOverstockItem,
  right: ScoredOverstockItem
): number {
  if (right.opportunity_score !== left.opportunity_score) {
    return right.opportunity_score - left.opportunity_score;
  }
  return left.sku.localeCompare(right.sku);
}

/**
 * Floor → score → rank. Empty input returns [].
 */
export function scoreOverstockCandidates(
  candidates: ScoringCandidate[]
): ScoredOverstockItem[] {
  const filtered = candidates.filter(passesTrickleFloor);
  if (filtered.length === 0) {
    return [];
  }

  const logExcessValues = filtered.map((c) =>
    safeLog1p(c.excess_value_local)
  );
  const logExcessUnits = filtered.map((c) => safeLog1p(c.excess_units));
  const logVelocities = filtered.map((c) => safeLog1p(velocityRaw(c)));
  const mocBanded = filtered.map((c) =>
    clamp(c.months_of_cover, MOC_SCORE_BAND_MIN, MAX_MONTHS_OF_COVER)
  );

  const minLogValue = Math.min(...logExcessValues);
  const maxLogValue = Math.max(...logExcessValues);
  const minLogUnits = Math.min(...logExcessUnits);
  const maxLogUnits = Math.max(...logExcessUnits);
  const minLogVel = Math.min(...logVelocities);
  const maxLogVel = Math.max(...logVelocities);
  const minMoc = Math.min(...mocBanded);
  const maxMoc = Math.max(...mocBanded);

  const scored: ScoredOverstockItem[] = filtered.map((candidate, index) => {
    const excessValueNorm = minMaxNorm(
      logExcessValues[index]!,
      minLogValue,
      maxLogValue
    );
    const excessUnitsNorm = minMaxNorm(
      logExcessUnits[index]!,
      minLogUnits,
      maxLogUnits
    );
    const velocityNorm = minMaxNorm(
      logVelocities[index]!,
      minLogVel,
      maxLogVel
    );
    const mocNorm = minMaxNorm(mocBanded[index]!, minMoc, maxMoc);

    const weighted =
      WEIGHT_EXCESS_VALUE * excessValueNorm +
      WEIGHT_EXCESS_UNITS * excessUnitsNorm +
      WEIGHT_VELOCITY * velocityNorm +
      WEIGHT_MONTHS_OF_COVER * mocNorm;

    const opportunityScore = clamp(Math.round(100 * weighted), 0, 100);

    return {
      ...candidate,
      product_group: productGroupFromCategory(candidate.category),
      opportunity_score: opportunityScore,
      score_breakdown: {
        excess_value: excessValueNorm,
        excess_units: excessUnitsNorm,
        velocity: velocityNorm,
        months_of_cover: mocNorm,
      },
      rank: 0,
    };
  });

  scored.sort(compareScoreThenSku);

  return scored.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/**
 * Pick top `count` scored items, diversifying by product_group first, then
 * filling by pure score. Alternates = next 2–3 by score excluding selected.
 */
export function selectTopRecommendations(
  scored: ScoredOverstockItem[],
  count: number = DEFAULT_TOP_COUNT,
  alternateCount: number = DEFAULT_ALTERNATE_COUNT
): TopRecommendationsResult {
  if (scored.length === 0 || count <= 0) {
    return { selected: [], alternates: [] };
  }

  const ordered = [...scored].sort(compareScoreThenSku);
  const selected: ScoredOverstockItem[] = [];
  const selectedSkus = new Set<string>();
  const representedGroups = new Set<string>();

  for (const item of ordered) {
    if (selected.length >= count) {
      break;
    }
    if (representedGroups.has(item.product_group)) {
      continue;
    }
    selected.push(item);
    selectedSkus.add(item.sku);
    representedGroups.add(item.product_group);
  }

  for (const item of ordered) {
    if (selected.length >= count) {
      break;
    }
    if (selectedSkus.has(item.sku)) {
      continue;
    }
    selected.push(item);
    selectedSkus.add(item.sku);
  }

  const alternates: ScoredOverstockItem[] = [];
  for (const item of ordered) {
    if (alternates.length >= alternateCount) {
      break;
    }
    if (selectedSkus.has(item.sku)) {
      continue;
    }
    alternates.push(item);
  }

  return { selected, alternates };
}

/** Normalized excess_value at/above this → "high" phrasing. */
export const NARRATIVE_EXCESS_HIGH = 0.7;

/** Normalized excess_value at/above this (below high) → "substantial". */
export const NARRATIVE_EXCESS_SUBSTANTIAL = 0.4;

/**
 * Normalized excess_value at/above this means the item is at the set maximum
 * after min-max (true top of eligible set for capital tied up).
 */
export const NARRATIVE_EXCESS_TOP_OF_SET = 0.999;

/** Normalized velocity at/above this → still selling steadily. */
export const NARRATIVE_VELOCITY_HIGH = 0.6;

/** Normalized velocity at/above this (below high) → moving slowly but consistently. */
export const NARRATIVE_VELOCITY_MODERATE = 0.3;

/** MoC upper bound for "moderately overstocked" (inclusive). */
export const NARRATIVE_MOC_MODERATE_MAX = 24;

/** MoC upper bound for "significantly overstocked" (inclusive). */
export const NARRATIVE_MOC_SIGNIFICANT_MAX = 48;

/** Catalogue categories treated as broad merchandising buckets. */
const NARRATIVE_BROAD_CATEGORIES = new Set(
  [
    "battery",
    "accessory",
    "access",
    "tyre",
    "tyres",
    "bike parts",
    "materials",
  ].map((value) => value.toLowerCase())
);

function formatJmdNarrative(value: number): string {
  return `J$${Math.round(value).toLocaleString()}`;
}

function breakdownFactor(
  breakdown: Record<string, number>,
  key: string
): number {
  const value = breakdown[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Short one-line summary (legacy-style). Prefer buildSelectionNarrative for persistence.
 */
export function buildSelectionSummary(item: ScoredOverstockItem): string {
  const velocity = breakdownFactor(item.score_breakdown, "velocity");
  const movementLabel =
    velocity >= NARRATIVE_VELOCITY_HIGH
      ? "strong recent movement"
      : velocity >= NARRATIVE_VELOCITY_MODERATE
        ? "moderate recent movement"
        : "limited recent movement";

  return [
    `High excess value (${formatJmdNarrative(item.excess_value_local)})`,
    movementLabel,
    `${Math.round(item.months_of_cover)} months cover`,
  ].join(", ");
}

/**
 * Deterministic 2–4 sentence narrative for selection_reason.
 * Every clause maps to score_breakdown and/or candidate inventory fields.
 */
export function buildSelectionNarrative(item: ScoredOverstockItem): string {
  const excessNorm = breakdownFactor(item.score_breakdown, "excess_value");
  const velocityNorm = breakdownFactor(item.score_breakdown, "velocity");
  const excessValueLabel = formatJmdNarrative(item.excess_value_local);
  const months = item.months_of_cover;
  const monthsRounded =
    Number.isFinite(months) && months >= 10
      ? String(Math.round(months))
      : months.toFixed(1);

  let excessSentence: string;
  if (excessNorm >= NARRATIVE_EXCESS_TOP_OF_SET) {
    excessSentence = `This SKU carries the highest excess value in the eligible set (${excessValueLabel} across ${Math.round(item.excess_units)} excess units).`;
  } else if (excessNorm >= NARRATIVE_EXCESS_HIGH) {
    excessSentence = `This SKU holds high excess stock valued at ${excessValueLabel} (${Math.round(item.excess_units)} excess units; excess-value score ${excessNorm.toFixed(2)}).`;
  } else if (excessNorm >= NARRATIVE_EXCESS_SUBSTANTIAL) {
    excessSentence = `This SKU holds a substantial ${excessValueLabel} in excess stock (${Math.round(item.excess_units)} excess units; excess-value score ${excessNorm.toFixed(2)}).`;
  } else {
    excessSentence = `This SKU holds moderate excess stock valued at ${excessValueLabel} (${Math.round(item.excess_units)} excess units; excess-value score ${excessNorm.toFixed(2)}).`;
  }

  const velocitySource =
    item.avg_monthly_last_3m !== null &&
    Number.isFinite(item.avg_monthly_last_3m)
      ? `avg ${item.avg_monthly_last_3m.toFixed(1)} units/month over the last 3 months`
      : item.units_sold_last_30d !== null &&
          Number.isFinite(item.units_sold_last_30d)
        ? `${Math.round(item.units_sold_last_30d)} units sold in the last 30 days`
        : "no recent velocity magnitude beyond the eligibility floor";

  let movementSentence: string;
  if (velocityNorm >= NARRATIVE_VELOCITY_HIGH) {
    movementSentence = `Recent movement is strong (${velocitySource}; velocity score ${velocityNorm.toFixed(2)}), so this is overstock rather than dead inventory.`;
  } else if (velocityNorm >= NARRATIVE_VELOCITY_MODERATE) {
    movementSentence = `Recent movement is moderate (${velocitySource}; velocity score ${velocityNorm.toFixed(2)}): the stock is moving slowly but consistently.`;
  } else {
    movementSentence = `Recent movement is limited but present (${velocitySource}; velocity score ${velocityNorm.toFixed(2)}), so the item cleared the sales-recency floor without looking like a top mover.`;
  }

  let coverSentence: string;
  if (months <= NARRATIVE_MOC_MODERATE_MAX) {
    coverSentence = `At ${monthsRounded} months of cover it is moderately overstocked (above the 6-month overstock gate, within the advertisable range).`;
  } else if (months <= NARRATIVE_MOC_SIGNIFICANT_MAX) {
    coverSentence = `At ${monthsRounded} months of cover it is significantly overstocked, indicating clear pressure to move units.`;
  } else {
    coverSentence = `At ${monthsRounded} months of cover it is heavily overstocked but still within the advertisable range (capped at ${MAX_MONTHS_OF_COVER} months for scoring).`;
  }

  const sentences = [excessSentence, movementSentence, coverSentence];

  const category = item.category?.trim();
  if (category) {
    const audienceKind = NARRATIVE_BROAD_CATEGORIES.has(category.toLowerCase())
      ? "broad"
      : "defined";
    sentences.push(
      `As a ${category} item, it targets a ${audienceKind} audience within that catalogue group.`
    );
  }

  return sentences.join(" ");
}
