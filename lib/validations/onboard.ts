import { z } from "zod";

import { visualAudienceProfileSchema } from "@/lib/validations/visual-audience";

export const INDUSTRY_SUGGESTIONS = [
  "Retail",
  "Hospitality",
  "Construction",
  "Home Improvement",
  "Healthcare",
  "Professional Services",
  "Real Estate",
  "Food & Beverage",
  "Manufacturing",
  "Education",
  "Technology",
  "Beauty & Wellness",
  "Automotive",
  "Finance",
  "Non-profit",
  "Entertainment",
  "Fitness",
  "Agriculture",
] as const;

export const TONES = [
  "Professional",
  "Casual",
  "Playful",
  "Bold",
] as const;

export const IMAGE_STYLES = [
  "Lifestyle",
  "Corporate",
  "Bold",
  "Minimal",
] as const;

export const PLATFORMS = [
  "Instagram",
  "LinkedIn",
  "X",
  "Facebook",
] as const;

export const TIMEZONES = [
  { value: "America/Jamaica", label: "America/Jamaica (EST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "America/Toronto", label: "America/Toronto (EST/EDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "UTC", label: "UTC" },
] as const;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #0D9488)");

const onboardBaseSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only"
    ),
  ownerEmail: z.string().email("Valid email is required"),
  industry: z
    .array(z.string().min(1))
    .min(1, "Add at least one industry"),
  targetAudience: z.string().min(10, "Describe the target audience"),
  uniqueSellingPoint: z.string().min(10, "Describe the unique selling point"),
  tone: z.enum(TONES, { message: "Select a tone" }),
  brandVoiceDoc: z
    .string()
    .min(20, "Brand voice document must be at least 20 characters"),
  topicsToCover: z
    .array(z.string().min(1))
    .min(1, "Add at least one topic to cover"),
  topicsToAvoid: z.array(z.string().min(1)),
  competitorHandles: z.array(z.string().min(1)),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  logoUrl: z.string().url().nullable(),
  imageStyle: z.enum(IMAGE_STYLES, { message: "Select an image style" }),
  postFrequency: z.number().int().min(3).max(7),
  activePlatforms: z
    .array(z.enum(PLATFORMS))
    .min(1, "Select at least one platform"),
  timezone: z.string().min(1, "Select a timezone"),
  promotionalPct: z.number().int().min(0).max(100),
  educationalPct: z.number().int().min(0).max(100),
  engagementPct: z.number().int().min(0).max(100),
  preferredTimes: z.record(z.string(), z.string()),
});

export const onboardSchema = onboardBaseSchema
  .refine(
    (data) =>
      data.promotionalPct + data.educationalPct + data.engagementPct === 100,
    {
      message: "Content mix percentages must sum to 100",
      path: ["promotionalPct"],
    }
  )
  .refine(
    (data) =>
      data.activePlatforms.every(
        (platform) =>
          data.preferredTimes[platform] &&
          /^\d{2}:\d{2}$/.test(data.preferredTimes[platform])
      ),
    {
      message: "Set a preferred posting time for each active platform",
      path: ["preferredTimes"],
    }
  );

export type OnboardFormData = z.infer<typeof onboardSchema>;

export const onboardStep1Schema = onboardBaseSchema.pick({
  companyName: true,
  slug: true,
  ownerEmail: true,
  industry: true,
  targetAudience: true,
  uniqueSellingPoint: true,
});

export const onboardStep2ConnectSchema = z.object({}).passthrough();

export const onboardStep3Schema = onboardBaseSchema.pick({
  tone: true,
  brandVoiceDoc: true,
  topicsToCover: true,
  topicsToAvoid: true,
  competitorHandles: true,
});

export const onboardStep4Schema = onboardBaseSchema.pick({
  primaryColor: true,
  secondaryColor: true,
  accentColor: true,
  logoUrl: true,
  imageStyle: true,
  postFrequency: true,
  activePlatforms: true,
  timezone: true,
});

export const ONBOARD_STEP_SCHEMAS = {
  1: onboardStep1Schema,
  2: onboardStep2ConnectSchema,
  3: onboardStep3Schema,
  4: onboardStep4Schema,
  5: onboardSchema,
} as const;

export function validateOnboardStep(
  step: keyof typeof ONBOARD_STEP_SCHEMAS,
  data: OnboardFormData
) {
  return ONBOARD_STEP_SCHEMAS[step].safeParse(data);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const defaultOnboardValues: OnboardFormData = {
  companyName: "",
  slug: "",
  ownerEmail: "",
  industry: [],
  targetAudience: "",
  uniqueSellingPoint: "",
  tone: "Professional",
  brandVoiceDoc: "",
  topicsToCover: [],
  topicsToAvoid: [],
  competitorHandles: [],
  primaryColor: "#0B1C3D",
  secondaryColor: "#FFFFFF",
  accentColor: "#0D9488",
  logoUrl: null,
  imageStyle: "Lifestyle",
  postFrequency: 5,
  activePlatforms: [],
  timezone: "America/Jamaica",
  promotionalPct: 20,
  educationalPct: 50,
  engagementPct: 30,
  preferredTimes: {},
};

export const createClientSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only"
    ),
  ownerEmail: z.string().email("Valid email is required"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const setupCompanyDetailsSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  ownerEmail: z.string().email("Valid email is required"),
  industry: z
    .array(z.string().min(1))
    .min(1, "Add at least one industry"),
  targetAudience: z.string().min(10, "Describe the target audience"),
  uniqueSellingPoint: z.string().min(10, "Describe the unique selling point"),
  visualAudienceProfile: visualAudienceProfileSchema,
});

export const setupConnectSchema = z.object({
  activePlatforms: z.array(z.enum(PLATFORMS)),
});

export const setupBrandVoiceSchema = z.object({
  tone: z.enum(TONES, { message: "Select a tone" }),
  brandVoiceDoc: z
    .string()
    .min(50, "Brand voice document must be at least 50 characters"),
  topicsToCover: z
    .array(z.string().min(1))
    .min(3, "Add at least three topics to cover"),
  topicsToAvoid: z.array(z.string().min(1)),
  competitorHandles: z.array(z.string().min(1)),
});

export const setupVisualIdentitySchema = onboardBaseSchema.pick({
  primaryColor: true,
  secondaryColor: true,
  accentColor: true,
  logoUrl: true,
  imageStyle: true,
});

export const setupContentMixSchema = onboardBaseSchema
  .pick({
    postFrequency: true,
    promotionalPct: true,
    educationalPct: true,
    engagementPct: true,
    preferredTimes: true,
    timezone: true,
    activePlatforms: true,
  })
  .refine(
    (data) =>
      data.promotionalPct + data.educationalPct + data.engagementPct === 100,
    {
      message: "Content mix percentages must sum to 100",
      path: ["promotionalPct"],
    }
  )
  .refine(
    (data) =>
      data.activePlatforms.every(
        (platform) =>
          data.preferredTimes[platform] &&
          /^\d{2}:\d{2}$/.test(data.preferredTimes[platform])
      ),
    {
      message: "Set a preferred posting time for each active platform",
      path: ["preferredTimes"],
    }
  );

export const launchClientSchema = z.object({
  companyId: z.string().uuid(),
  launch: z.literal(true),
});

export function adjustContentMix(
  current: Pick<
    OnboardFormData,
    "promotionalPct" | "educationalPct" | "engagementPct"
  >,
  changed: "promotionalPct" | "educationalPct" | "engagementPct",
  newValue: number
): Pick<
  OnboardFormData,
  "promotionalPct" | "educationalPct" | "engagementPct"
> {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const result = {
    ...current,
    [changed]: clamped,
  };
  const others = (
    ["promotionalPct", "educationalPct", "engagementPct"] as const
  ).filter((key) => key !== changed);
  const remaining = 100 - clamped;
  const otherSum = others.reduce((sum, key) => sum + current[key], 0);

  if (otherSum === 0) {
    const half = Math.floor(remaining / 2);
    result[others[0]] = half;
    result[others[1]] = remaining - half;
  } else {
    const first = Math.round((current[others[0]] / otherSum) * remaining);
    result[others[0]] = first;
    result[others[1]] = remaining - first;
  }

  return result;
}
