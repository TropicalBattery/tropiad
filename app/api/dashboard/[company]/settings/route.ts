import { apiError, apiSuccess } from "@/lib/api/response";
import { assertClientCompanyAccess } from "@/lib/data/client-settings-access";
import { updateBrandConfigRow } from "@/lib/onboarding/brand-config-persistence";
import { createAdminClient } from "@/lib/supabase/server";
import type { BrandConfig } from "@/lib/supabase/types";
import { clientBrandConfigPatchSchema } from "@/lib/validations/client-brand-settings";

type RouteContext = {
  params: { company: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const company = await assertClientCompanyAccess(context.params.company);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const parsed = clientBrandConfigPatchSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => issue.message).join(". ") ||
        "Invalid request body";
      return apiError(message, 400);
    }

    const admin = createAdminClient();
    const { data, error } = await updateBrandConfigRow(
      admin,
      company.id,
      parsed.data
    );

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess(data as BrandConfig);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings.";
    return apiError(message, 500);
  }
}
