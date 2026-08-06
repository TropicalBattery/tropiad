import { z } from "zod";

import {
  normalizeImageStyle,
  normalizeIndustries,
  normalizePlatform,
  normalizeStringArray,
  normalizeTone,
} from "@/lib/validations/brand-config-normalize";
import { visualAudienceProfileSchema } from "@/lib/validations/visual-audience";
import {
  IMAGE_STYLES,
  PLATFORMS,
  TONES,
} from "@/lib/validations/onboard";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

const optionalUrl = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().url().nullable().optional()
);

function filterNonEmptyStrings(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.filter(
    (item) => typeof item === "string" && item.trim().length > 0
  );
}

export const brandConfigPatchSchema = z
  .object({
    industry: z.preprocess(
      (value) => {
        const normalized = normalizeIndustries(value as string | string[] | null);
        return normalized.length === 0 ? undefined : normalized;
      },
      z.array(z.string().min(1)).optional()
    ),
    target_audience: z.string().optional(),
    unique_selling_point: z.string().optional(),
    tone: z.preprocess(
      (value) => (typeof value === "string" ? normalizeTone(value) : value),
      z.enum(TONES).optional()
    ),
    brand_voice_doc: z.string().nullable().optional(),
    topics_to_cover: z.preprocess(
      (value) => normalizeStringArray(value as string | string[] | null),
      z.array(z.string().min(1)).optional()
    ),
    topics_to_avoid: z.preprocess(
      (value) => normalizeStringArray(value as string | string[] | null),
      z.array(z.string().min(1)).optional()
    ),
    competitor_handles: z.preprocess(
      (value) => normalizeStringArray(value as string | string[] | null),
      z.array(z.string().min(1)).optional()
    ),
    primary_color: hexColor.optional(),
    secondary_color: hexColor.optional(),
    accent_color: hexColor.optional(),
    logo_url: optionalUrl,
    image_style: z.preprocess(
      (value) =>
        typeof value === "string" ? normalizeImageStyle(value) : value,
      z.enum(IMAGE_STYLES).optional()
    ),
    visual_references: z.preprocess(
      filterNonEmptyStrings,
      z.array(z.string().min(1)).optional()
    ),
    active_platforms: z.preprocess(
      (value) =>
        Array.isArray(value)
          ? value.map((item) =>
              typeof item === "string" ? normalizePlatform(item) : item
            )
          : value,
      z.array(z.enum(PLATFORMS)).optional()
    ),
    post_frequency: z.number().int().min(1).max(7).optional(),
    preferred_times: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .optional(),
    timezone: z.string().optional(),
    promotional_pct: z.number().int().min(0).max(100).optional(),
    educational_pct: z.number().int().min(0).max(100).optional(),
    engagement_pct: z.number().int().min(0).max(100).optional(),
    visual_audience_profile: visualAudienceProfileSchema.optional(),
    notification_emails: z.array(z.string().email()).optional(),
    ga_property_id: z.preprocess(
      (value) => (value === "" ? null : value),
      z.string().nullable().optional()
    ),
    zernio_account_ids: z.record(z.string(), z.string()).optional(),
    hashtag_sets: z.any().optional(),
    sections_confirmed: z.record(z.string(), z.boolean()).optional(),
  })
  .passthrough()
  .refine(
    (data) => {
      const mixValues = [
        data.promotional_pct,
        data.educational_pct,
        data.engagement_pct,
      ];
      const hasMix = mixValues.some((value) => value !== undefined);
      if (!hasMix) {
        return true;
      }
      if (mixValues.some((value) => value === undefined)) {
        return false;
      }
      return (
        (data.promotional_pct ?? 0) +
          (data.educational_pct ?? 0) +
          (data.engagement_pct ?? 0) ===
        100
      );
    },
    { message: "Content mix percentages must sum to 100" }
  );

export type BrandConfigPatchInput = z.infer<typeof brandConfigPatchSchema>;
