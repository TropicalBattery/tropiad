import { z } from "zod";

import type { Json } from "@/lib/supabase/types";

export const VISUAL_AUDIENCE_DEMOGRAPHICS = [
  "local",
  "tourist",
  "mixed",
] as const;

export type VisualAudienceDemographic =
  (typeof VISUAL_AUDIENCE_DEMOGRAPHICS)[number];

export type VisualAudienceProfile = {
  demographic: VisualAudienceDemographic;
  local_pct: number;
};

export const defaultVisualAudienceProfile: VisualAudienceProfile = {
  demographic: "local",
  local_pct: 100,
};

export const visualAudienceProfileSchema = z.object({
  demographic: z.enum(VISUAL_AUDIENCE_DEMOGRAPHICS),
  local_pct: z.number().int().min(0).max(100),
});

export function parseVisualAudienceProfile(
  value: Json | null | undefined
): VisualAudienceProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultVisualAudienceProfile;
  }

  const record = value as Record<string, Json | undefined>;
  const demographic = record.demographic;

  if (
    demographic !== "local" &&
    demographic !== "tourist" &&
    demographic !== "mixed"
  ) {
    return defaultVisualAudienceProfile;
  }

  const localPct =
    typeof record.local_pct === "number" && Number.isFinite(record.local_pct)
      ? Math.min(100, Math.max(0, Math.round(record.local_pct)))
      : defaultVisualAudienceProfile.local_pct;

  return {
    demographic,
    local_pct: localPct,
  };
}

export function buildVisualAudienceProfileForSave(
  demographic: VisualAudienceDemographic,
  localPct: number
): VisualAudienceProfile {
  if (demographic === "local") {
    return { demographic: "local", local_pct: 100 };
  }

  if (demographic === "tourist") {
    return { demographic: "tourist", local_pct: 0 };
  }

  const normalizedLocalPct = Math.min(
    100,
    Math.max(0, Math.round(localPct / 10) * 10)
  );

  return {
    demographic: "mixed",
    local_pct: normalizedLocalPct,
  };
}

export function formatVisualAudienceLabel(
  value: Json | null | undefined
): string | null {
  if (value == null) {
    return null;
  }

  const profile = parseVisualAudienceProfile(value);

  if (profile.demographic === "local") {
    return "Local";
  }

  if (profile.demographic === "tourist") {
    return "Tourist / International";
  }

  return `Mixed (${profile.local_pct}% local)`;
}
