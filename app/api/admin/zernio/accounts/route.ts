import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { listZernioAccounts } from "@/lib/zernio/connect";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return apiError("companyId is required.", 400);
  }

  const admin = createAdminClient();
  const { data: brand, error: brandError } = await admin
    .from("brand_configs")
    .select("zernio_profile_id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (brandError) {
    return apiError(brandError.message, 500);
  }

  if (!brand?.zernio_profile_id) {
    return apiSuccess({ accounts: [] });
  }

  try {
    const accounts = await listZernioAccounts(brand.zernio_profile_id);
    return apiSuccess({ accounts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list Zernio accounts.";
    return apiError(message, 500);
  }
}
