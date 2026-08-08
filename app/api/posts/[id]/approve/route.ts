import { apiError, apiSuccess } from "@/lib/api/response";
import { calculateScheduledAt } from "@/lib/agents/calculate-scheduled-at";
import { advanceRun } from "@/lib/agents/run-processor";
import { publishPost } from "@/lib/agents/scheduler";
import { createAdminClient } from "@/lib/supabase/admin";

/** Hobby ceiling is 60s; raise to 300 on Pro if image production times out. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

type ApproveBody = {
  gate?: 1 | 2;
  /** Gate 2 only: approve and publish to Zernio immediately (publishNow). */
  publishNow?: boolean;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as ApproveBody;

    if (body.gate !== 1 && body.gate !== 2) {
      return apiError("gate must be 1 or 2.", 400);
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (postError || !post) {
      return apiError(postError?.message ?? "Post not found.", 404);
    }

    if (body.gate === 1) {
      const { data: updatedPost, error: updateError } = await supabase
        .from("posts")
        .update({
          gate1_status: "approved",
          pipeline_stage: "ideation",
          gate1_reviewed_at: now,
        })
        .eq("id", params.id)
        .select("*")
        .single();

      if (updateError || !updatedPost) {
        return apiError(updateError?.message ?? "Failed to approve concept.", 500);
      }

      if (updatedPost.run_id) {
        void advanceRun(updatedPost.run_id).catch((err) => {
          console.error("[approve] advanceRun error:", err);
        });
      }

      return apiSuccess({
        post: updatedPost,
        message: "Gate 1 approved.",
      });
    }

    const publishNow = Boolean(body.publishNow);
    let scheduledAt: string;

    if (publishNow) {
      scheduledAt = now;
    } else {
      try {
        scheduledAt = await calculateScheduledAt(
          post.company_id,
          post.platform
        );
      } catch (err) {
        console.error(
          "[approve] calculateScheduledAt failed, using fallback:",
          err
        );
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 1);
        fallback.setHours(9, 0, 0, 0);
        scheduledAt = fallback.toISOString();
      }
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({
        gate2_status: "approved",
        pipeline_stage: "ready",
        gate2_reviewed_at: now,
        scheduled_at: scheduledAt,
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (updateError || !updatedPost) {
      return apiError(updateError?.message ?? "Failed to approve post.", 500);
    }

    try {
      const publishResult = await publishPost(
        params.id,
        publishNow ? { immediate: true } : undefined
      );

      return apiSuccess({
        post: updatedPost,
        publish: publishResult,
        message: publishNow
          ? "Gate 2 approved and post published now to Zernio."
          : "Gate 2 approved and post published to Zernio.",
      });
    } catch (publishError) {
      console.error("[approve] publishPost failed:", publishError);
      const publishMessage =
        publishError instanceof Error
          ? publishError.message
          : "Failed to publish post.";

      return apiSuccess({
        post: updatedPost,
        publish: { success: false, error: publishMessage },
        message: "Gate 2 approved, but publishing to Zernio failed.",
      });
    }
  } catch (error) {
    console.error("[approve] FATAL:", error);
    const message =
      error instanceof Error ? error.message : "Failed to approve post.";
    return apiError(message, 500);
  }
}
