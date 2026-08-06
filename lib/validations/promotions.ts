import { format } from "date-fns";
import { z } from "zod";

import type { Promotion } from "@/lib/supabase/types";

export const PROMOTION_DISCOUNT_TYPES = [
  "percentage",
  "fixed",
  "bogo",
  "free_item",
  "other",
] as const;

export const PROMOTION_STATUSES = ["active", "scheduled", "expired"] as const;

export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const createPromotionSchema = z
  .object({
    company_id: z.string().uuid(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    discount_type: z.enum(PROMOTION_DISCOUNT_TYPES).optional(),
    discount_value: z.string().optional(),
    promo_code: z.string().optional(),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    platforms: z.array(z.string().min(1)).optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export const updatePromotionStatusSchema = z.object({
  status: z.enum(PROMOTION_STATUSES),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export function getTodayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function derivePromotionStatus(
  startDate: string,
  endDate: string,
  today = getTodayIso()
): PromotionStatus {
  if (today < startDate) {
    return "scheduled";
  }

  if (today > endDate) {
    return "expired";
  }

  return "active";
}

export function isPromotionActive(
  promotion: Pick<Promotion, "start_date" | "end_date">,
  today = getTodayIso()
): boolean {
  return promotion.start_date <= today && promotion.end_date >= today;
}

export function isPromotionScheduled(
  promotion: Pick<Promotion, "start_date" | "end_date">,
  today = getTodayIso()
): boolean {
  return promotion.start_date > today && promotion.end_date >= today;
}

export function formatPromotionDate(value: string): string {
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}
