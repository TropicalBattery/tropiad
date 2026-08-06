import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getSingleCompanyId } from "@/lib/config/single-company";
import { runOverstockAnalysis } from "@/lib/queries/overstock-analysis";

export async function POST() {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const companyId = getSingleCompanyId();
    const recommendations = await runOverstockAnalysis(
      companyId,
      sessionUser.email ?? null
    );

    return apiSuccess(
      {
        recommendations,
        count: recommendations.length,
      },
      201
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run overstock analysis.";
    return apiError(message, 500);
  }
}
