import { z } from "zod";

import {
  IMAGE_STYLES,
  TONES,
  TIMEZONES,
} from "@/lib/validations/onboard";
import { visualAudienceProfileSchema } from "@/lib/validations/visual-audience";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

export const clientCompanyDetailsSchema = z.object({
  target_audience: z.string().min(1),
  unique_selling_point: z.string().min(1),
  visual_audience_profile: visualAudienceProfileSchema,
});

export const clientBrandVoiceSchema = z.object({
  tone: z.enum(TONES),
  topics_to_cover: z.array(z.string().min(1)),
  topics_to_avoid: z.array(z.string().min(1)),
  brand_voice_doc: z.string().nullable(),
});

export const clientVisualIdentitySchema = z.object({
  primary_color: hexColor,
  secondary_color: hexColor,
  accent_color: hexColor,
  image_style: z.enum(IMAGE_STYLES),
  logo_url: z.string().url().nullable().optional(),
});

export const clientContentPreferencesFieldsSchema = z.object({
  post_frequency: z.number().int().min(1).max(7),
  promotional_pct: z.number().int().min(0).max(100),
  educational_pct: z.number().int().min(0).max(100),
  engagement_pct: z.number().int().min(0).max(100),
  timezone: z.string().min(1),
});

export const clientContentPreferencesSchema =
  clientContentPreferencesFieldsSchema.refine(
    (data) =>
      data.promotional_pct + data.educational_pct + data.engagement_pct ===
      100,
    { message: "Content mix percentages must sum to 100" }
  );

export const clientNotificationsSchema = z.object({
  notification_emails: z.array(z.string().email()),
});

export const clientBrandConfigPatchSchema = clientCompanyDetailsSchema
  .partial()
  .merge(clientBrandVoiceSchema.partial())
  .merge(clientVisualIdentitySchema.partial())
  .merge(clientContentPreferencesFieldsSchema.partial())
  .merge(clientNotificationsSchema.partial())
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  })
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

export { FREQUENCY_OPTIONS, POST_FREQUENCY_OPTIONS } from "@/lib/validations/post-frequency";

export const IMAGE_STYLE_LABELS: Record<(typeof IMAGE_STYLES)[number], string> =
  {
    Lifestyle: "Photorealistic",
    Corporate: "Illustrated",
    Minimal: "Minimalist",
    Bold: "Bold & Graphic",
  };

export { TIMEZONES, TONES, IMAGE_STYLES };
