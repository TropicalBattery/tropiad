import { triggerGate2Revision } from "@/lib/api/agents";
import { apiError, apiSuccess } from "@/lib/api/response";
import { advanceRun } from "@/lib/agents/run-processor";
import { createAdminClient } from "@/lib/supabase/admin";

/** Hobby ceiling is 60s (legacy Hobby default is ~10s without this). */
export const maxDuration = 60;

type RouteContext = {
  params: {
    id: string;
  };
};

type EditBody = {
  gate?: 1 | 2;
  content?: string;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as EditBody;

    if (body.gate !== 1 && body.gate !== 2) {
      return apiError("gate must be 1 or 2.", 400);
    }

    if (!body.content?.trim()) {
      return apiError("content is required.", 400);
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    if (body.gate === 1) {
      const { data, error } = await supabase
        .from("posts")
        .update({
          concept: body.content.trim(),
          gate1_status: "approved",
          pipeline_stage: "ideation",
          gate1_reviewed_at: now,
        })
        .eq("id", params.id)
        .select("*")
        .single();

      if (error || !data) {
        return apiError(error?.message ?? "Post not found.", 404);
      }

      if (data.run_id) {
        void advanceRun(data.run_id).catch((err) => {
          console.error("[edit] advanceRun error:", err);
        });
      }

      return apiSuccess({
        post: data,
        message: "Concept updated and approved.",
      });
    }

    const { data, error } = await supabase
      .from("posts")
      .update({
        edit_feedback: body.content.trim(),
        gate2_status: "edit_requested",
        gate2_reviewed_at: now,
        pipeline_stage: "copywriting",
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error || !data) {
      return apiError(error?.message ?? "Post not found.", 404);
    }

    triggerGate2Revision(data);

    return apiSuccess({
      post: data,
      message: "Edit request saved. Caption and visual regeneration started.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update post.";
    return apiError(message, 500);
  }
}
