import { z } from "zod";

export type OverstockAiReview = {
  narrative: string;
  campaign_angle: "educational" | "promotional" | "awareness";
  target_audience: string;
  customer_problem: string;
  advertisable: boolean;
  notes?: string | null;
  model?: string;
};

export const overstockAiReviewSchema = z.object({
  narrative: z.string().min(1),
  campaign_angle: z.enum(["educational", "promotional", "awareness"]),
  target_audience: z.string().min(1),
  customer_problem: z.string().min(1),
  advertisable: z.boolean(),
  notes: z.string().nullable().optional(),
  model: z.string().optional(),
});

/** Safe parse of a stored ai_review jsonb value for UI/read paths. */
export function parseStoredOverstockAiReview(
  value: unknown
): OverstockAiReview | null {
  const validated = overstockAiReviewSchema.safeParse(value);
  return validated.success ? validated.data : null;
}
