import { apiError, apiSuccess } from "@/lib/api/response";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import {
  getSingleCompanyId,
  isSingleCompanySlug,
} from "@/lib/config/single-company";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: { company: string };
};

/**
 * Lightweight refresh payload for the Approval Queue.
 * Returns unresolved posts for the pinned company only.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !isAllowedAppRole(sessionUser.role)) {
      return apiError("Unauthorized.", 401);
    }

    if (!isSingleCompanySlug(params.company)) {
      return apiError("Company is not authorised.", 403);
    }

    const companyId = getSingleCompanyId();
    const supabase = createAdminClient();

    const { data: posts, error } = await supabase
      .from("posts")
      .select("*")
      .eq("company_id", companyId)
      .not("pipeline_stage", "in", "(published,rejected)")
      .or(
        "gate1_status.eq.pending,gate2_status.eq.pending,gate2_status.eq.edit_requested,and(gate1_status.eq.approved,pipeline_stage.in.(ideation,visual,producing,failed,awaiting_connection,copywriting,ready))"
      )
      .order("created_at", { ascending: true });

    if (error) {
      return apiError(error.message, 500);
    }

    const runIds = Array.from(
      new Set(
        (posts ?? [])
          .map((post) => post.run_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const contentRuns =
      runIds.length > 0
        ? (
            await supabase
              .from("content_runs")
              .select("id, week_start, status")
              .eq("company_id", companyId)
              .in("id", runIds)
              .order("week_start", { ascending: false })
          ).data ?? []
        : [];

    return apiSuccess({
      posts: posts ?? [],
      contentRuns,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load approval queue.";
    return apiError(message, 500);
  }
}
