import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createAdminClient();

    const { data: cycle, error: cycleError } = await supabase
      .from("cycles")
      .select("*")
      .eq("id", params.id)
      .single();

    if (cycleError || !cycle) {
      return apiError(cycleError?.message ?? "Cycle not found.", 404);
    }

    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("gate1_status, gate2_status, pipeline_stage")
      .eq("company_id", cycle.company_id)
      .gte("created_at", `${cycle.week_start}T00:00:00.000Z`);

    if (postsError) {
      return apiError(postsError.message, 500);
    }

    const postCounts = {
      total: posts?.length ?? 0,
      gate1_pending:
        posts?.filter((post) => post.gate1_status === "pending").length ?? 0,
      gate1_approved:
        posts?.filter((post) => post.gate1_status === "approved").length ?? 0,
      gate1_rejected:
        posts?.filter((post) => post.gate1_status === "rejected").length ?? 0,
      gate2_pending:
        posts?.filter((post) => post.gate2_status === "pending").length ?? 0,
      gate2_approved:
        posts?.filter((post) => post.gate2_status === "approved").length ?? 0,
      gate2_edit_requested:
        posts?.filter((post) => post.gate2_status === "edit_requested").length ??
        0,
      published:
        posts?.filter((post) => post.pipeline_stage === "published").length ?? 0,
      failed:
        posts?.filter((post) => post.pipeline_stage === "failed").length ?? 0,
    };

    return apiSuccess({
      cycle,
      post_counts: postCounts,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch cycle.";
    return apiError(message, 500);
  }
}
