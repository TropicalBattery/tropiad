import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Promotion } from "@/lib/supabase/types";
import { updatePromotionStatusSchema } from "@/lib/validations/promotions";

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body: unknown = await request.json();
    const parsed = updatePromotionStatusSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => issue.message).join(". ") ||
        "Invalid promotion status.";
      return apiError(message, 400);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("promotions")
      .update({ status: parsed.data.status })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error || !data) {
      return apiError(error?.message ?? "Promotion not found.", 404);
    }

    return apiSuccess(data as Promotion);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update promotion.";
    return apiError(message, 500);
  }
}
