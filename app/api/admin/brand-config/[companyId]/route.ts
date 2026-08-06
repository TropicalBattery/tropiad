import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/server";
import { updateBrandConfigRow } from "@/lib/onboarding/brand-config-persistence";
import type { BrandConfig } from "@/lib/supabase/types";
import { brandConfigPatchSchema } from "@/lib/validations/brand-config-admin";

type RouteContext = {
  params: { companyId: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const { companyId } = context.params;

  let body: unknown;
  try {
    body = await request.json();
    console.log(
      "[brand-config PATCH] body:",
      JSON.stringify(body, null, 2)
    );
  } catch (error) {
    console.error("[brand-config PATCH] error:", error);
    return apiError("Invalid JSON body", 400);
  }

  const parsed = brandConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    console.error(
      "[brand-config PATCH] validation errors:",
      JSON.stringify(parsed.error.issues, null, 2)
    );
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request body";
    return apiError(message, 400);
  }

  if (Object.keys(parsed.data).length === 0) {
    return apiError("No fields to update", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await updateBrandConfigRow(
    admin,
    companyId,
    parsed.data
  );

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data as BrandConfig);
}
