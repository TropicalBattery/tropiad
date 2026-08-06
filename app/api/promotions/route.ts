import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Promotion } from "@/lib/supabase/types";
import {
  createPromotionSchema,
  derivePromotionStatus,
} from "@/lib/validations/promotions";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("company_id");

    if (!companyId) {
      return apiError("company_id query parameter is required.", 400);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("company_id", companyId)
      .order("start_date", { ascending: false });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess((data ?? []) as Promotion[]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch promotions.";
    return apiError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createPromotionSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => issue.message).join(". ") ||
        "Invalid promotion payload.";
      return apiError(message, 400);
    }

    const status = derivePromotionStatus(
      parsed.data.start_date,
      parsed.data.end_date
    );

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("promotions")
      .insert({
        company_id: parsed.data.company_id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        discount_type: parsed.data.discount_type ?? null,
        discount_value: parsed.data.discount_value?.trim() || null,
        promo_code: parsed.data.promo_code?.trim() || null,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        platforms: parsed.data.platforms ?? [],
        status,
      })
      .select("*")
      .single();

    if (error || !data) {
      return apiError(error?.message ?? "Failed to create promotion.", 500);
    }

    return apiSuccess(data as Promotion, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create promotion.";
    return apiError(message, 500);
  }
}
