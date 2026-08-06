import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getSingleCompanyId } from "@/lib/config/single-company";
import {
  approveOverstockRecommendation,
  OverstockApproveError,
} from "@/lib/queries/overstock-analysis";

/** Hobby ceiling is 60s; raise to 300 on Pro if approve+generation path times out. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const { id } = params;
  if (!id) {
    return apiError("Recommendation id is required.", 400);
  }

  let postCount: number | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      post_count?: unknown;
      postCount?: unknown;
    };
    const raw = body.post_count ?? body.postCount;
    if (raw !== undefined && raw !== null) {
      postCount = typeof raw === "number" ? raw : Number(raw);
    }
  } catch {
    return apiError("Invalid request body.", 400);
  }

  try {
    const companyId = getSingleCompanyId();
    const result = await approveOverstockRecommendation(
      id,
      companyId,
      sessionUser.email ?? null,
      postCount
    );

    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof OverstockApproveError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "already_queued"
            ? 409
            : 400;
      return apiError(error.message, status);
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to approve overstock recommendation.";
    return apiError(message, 500);
  }
}
