import type { BrandConfig, Company, Json } from "@/lib/supabase/types";
import { parseZernioAccountIds } from "@/lib/zernio/account-ids";
import {
  isSectionConfirmed,
  parseSectionsConfirmed,
  type SectionConfirmKey,
  type SectionsConfirmed,
} from "@/lib/onboarding/sections-confirmed";
import { isCatalogueIndustryEligible } from "@/lib/onboarding/catalogue-industries";
import {
  normalizeIndustries,
  normalizeStringArray,
} from "@/lib/validations/brand-config-normalize";

export type SectionStatus = "complete" | "partial" | "empty";

export type SetupCompleteness = {
  percent: number;
  sections: {
    companyDetails: SectionStatus;
    connectAccounts: SectionStatus;
    brandVoice: SectionStatus;
    visualIdentity: SectionStatus;
    contentMix: SectionStatus;
    catalogue: SectionStatus;
  };
  canLaunch: boolean;
};

function sectionScore(status: SectionStatus): number {
  if (status === "complete") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

function isNonEmpty(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function resolveConfirmedSectionStatus(
  confirmed: SectionsConfirmed,
  section: SectionConfirmKey,
  fieldsComplete: boolean
): SectionStatus {
  if (!isSectionConfirmed(confirmed, section)) {
    return "empty";
  }

  return fieldsComplete ? "complete" : "partial";
}

function companyDetailsFieldsComplete(
  company: Company,
  brandConfig: BrandConfig
): boolean {
  const industries = normalizeIndustries(brandConfig.industry);

  return (
    isNonEmpty(company.name) &&
    isNonEmpty(company.slug) &&
    isNonEmpty(company.owner_email) &&
    industries.length > 0 &&
    isNonEmpty(brandConfig.target_audience) &&
    isNonEmpty(brandConfig.unique_selling_point)
  );
}

function getCompanyDetailsStatus(
  company: Company,
  brandConfig: BrandConfig | null,
  confirmed: SectionsConfirmed
): SectionStatus {
  if (!brandConfig) {
    return "empty";
  }

  return resolveConfirmedSectionStatus(
    confirmed,
    "companyDetails",
    companyDetailsFieldsComplete(company, brandConfig)
  );
}

function connectAccountsFieldsComplete(brandConfig: BrandConfig): boolean {
  return hasZernioConnectedAccount(brandConfig);
}

export function hasZernioConnectedAccount(
  brandConfig: BrandConfig | null
): boolean {
  if (!brandConfig) {
    return false;
  }

  return Object.keys(parseZernioAccountIds(brandConfig.zernio_account_ids)).length > 0;
}

function getConnectAccountsStatus(
  brandConfig: BrandConfig | null,
  confirmed: SectionsConfirmed
): SectionStatus {
  if (!brandConfig) {
    return "empty";
  }

  return resolveConfirmedSectionStatus(
    confirmed,
    "connectAccounts",
    connectAccountsFieldsComplete(brandConfig)
  );
}

function brandVoiceFieldsComplete(brandConfig: BrandConfig): boolean {
  const hasTone = isNonEmpty(brandConfig.tone);
  const hasVoiceDoc = (brandConfig.brand_voice_doc?.trim().length ?? 0) >= 50;
  const topicsCount = normalizeStringArray(brandConfig.topics_to_cover).length;

  return hasTone && hasVoiceDoc && topicsCount >= 3;
}

function getBrandVoiceStatus(
  brandConfig: BrandConfig | null,
  confirmed: SectionsConfirmed
): SectionStatus {
  if (!brandConfig) {
    return "empty";
  }

  return resolveConfirmedSectionStatus(
    confirmed,
    "brandVoice",
    brandVoiceFieldsComplete(brandConfig)
  );
}

function visualIdentityFieldsComplete(brandConfig: BrandConfig): boolean {
  return (
    isNonEmpty(brandConfig.primary_color) &&
    isNonEmpty(brandConfig.secondary_color) &&
    isNonEmpty(brandConfig.accent_color) &&
    isNonEmpty(brandConfig.image_style)
  );
}

function getVisualIdentityStatus(
  brandConfig: BrandConfig | null,
  confirmed: SectionsConfirmed
): SectionStatus {
  if (!brandConfig) {
    return "empty";
  }

  return resolveConfirmedSectionStatus(
    confirmed,
    "visualIdentity",
    visualIdentityFieldsComplete(brandConfig)
  );
}

function contentMixFieldsComplete(brandConfig: BrandConfig): boolean {
  const mixTotal =
    brandConfig.promotional_pct +
    brandConfig.educational_pct +
    brandConfig.engagement_pct;

  return mixTotal === 100 && brandConfig.post_frequency > 0;
}

function getContentMixStatus(
  brandConfig: BrandConfig | null,
  confirmed: SectionsConfirmed
): SectionStatus {
  if (!brandConfig) {
    return "empty";
  }

  return resolveConfirmedSectionStatus(
    confirmed,
    "contentMix",
    contentMixFieldsComplete(brandConfig)
  );
}

function getCatalogueStatus(confirmed: SectionsConfirmed): SectionStatus {
  if (!isSectionConfirmed(confirmed, "catalogue")) {
    return "empty";
  }

  return "complete";
}

export function calculateCompleteness(
  company: Company,
  brandConfig: BrandConfig | null
): SetupCompleteness {
  const confirmed = parseSectionsConfirmed(brandConfig?.sections_confirmed);

  const sections = {
    companyDetails: getCompanyDetailsStatus(company, brandConfig, confirmed),
    connectAccounts: getConnectAccountsStatus(brandConfig, confirmed),
    brandVoice: getBrandVoiceStatus(brandConfig, confirmed),
    visualIdentity: getVisualIdentityStatus(brandConfig, confirmed),
    contentMix: getContentMixStatus(brandConfig, confirmed),
    catalogue: getCatalogueStatus(confirmed),
  };

  const industries = brandConfig
    ? normalizeIndustries(brandConfig.industry)
    : [];
  const includeCatalogue = isCatalogueIndustryEligible(industries);

  const trackedScores = [
    sectionScore(sections.companyDetails),
    sectionScore(sections.connectAccounts),
    sectionScore(sections.brandVoice),
    sectionScore(sections.visualIdentity),
    sectionScore(sections.contentMix),
  ];

  if (includeCatalogue) {
    trackedScores.push(sectionScore(sections.catalogue));
  }

  const averageScore =
    trackedScores.reduce((total, score) => total + score, 0) /
    trackedScores.length;

  const percent = Math.round(averageScore * 100);
  const canLaunch = percent >= 80;

  return {
    percent,
    sections,
    canLaunch,
  };
}

export function parsePreferredTimes(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}
