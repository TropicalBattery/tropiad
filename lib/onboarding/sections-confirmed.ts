import type { Json } from "@/lib/supabase/types";

export type SectionConfirmKey =
  | "companyDetails"
  | "connectAccounts"
  | "brandVoice"
  | "visualIdentity"
  | "contentMix"
  | "catalogue";

export type SectionsConfirmed = Partial<Record<SectionConfirmKey, boolean>>;

export function parseSectionsConfirmed(
  value: Json | null | undefined
): SectionsConfirmed {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: SectionsConfirmed = {};
  const keys: SectionConfirmKey[] = [
    "companyDetails",
    "connectAccounts",
    "brandVoice",
    "visualIdentity",
    "contentMix",
    "catalogue",
  ];

  for (const key of keys) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry === true) {
      result[key] = true;
    }
  }

  return result;
}

export function mergeSectionsConfirmed(
  current: Json | null | undefined,
  section: SectionConfirmKey
): SectionsConfirmed {
  return {
    ...parseSectionsConfirmed(current),
    [section]: true,
  };
}

export function isSectionConfirmed(
  confirmed: SectionsConfirmed,
  section: SectionConfirmKey
): boolean {
  return confirmed[section] === true;
}
