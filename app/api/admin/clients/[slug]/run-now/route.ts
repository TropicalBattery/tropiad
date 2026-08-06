import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  advanceRun,
  createWeeklyRun,
} from "@/lib/agents/run-processor";
import { getSingleCompanyId } from "@/lib/config/single-company";

/** Hobby ceiling is 60s; raise to 300 on Pro if create+advance (Claude) times out. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { slug: string };
};

export async function POST(_request: Request, _context: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  // Single-client mode: ignore URL slug; always run Tropical Battery.
  const companyId = getSingleCompanyId();

  try {
    const { runId, created, statusBefore } = await createWeeklyRun(companyId);
    const result = await advanceRun(runId);
    const ideationRan =
      (statusBefore === null || statusBefore === "pending") &&
      result.advanced === true;

    return apiSuccess({
      runId,
      status: result.status,
      advanced: result.advanced,
      created,
      statusBefore,
      ideationRan,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run pipeline.";
    return apiError(message, 500);
  }
}
