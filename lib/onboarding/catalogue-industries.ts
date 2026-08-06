export const CATALOGUE_ELIGIBLE_INDUSTRIES = [
  "Food & Beverage",
  "Hospitality",
  "Retail",
] as const;

export function isCatalogueIndustryEligible(industries: string[]): boolean {
  const normalized = new Set(
    industries.map((industry) => industry.trim().toLowerCase())
  );

  return CATALOGUE_ELIGIBLE_INDUSTRIES.some((industry) =>
    normalized.has(industry.toLowerCase())
  );
}
