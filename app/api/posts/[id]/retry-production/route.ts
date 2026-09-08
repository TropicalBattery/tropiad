import { apiError, apiSuccess } from "@/lib/api/response";
import { advanceRun } from "@/lib/agents/run-processor";
import { composeVideo } from "@/lib/agents/video-composer";
import {
  isRetryableProductionPost,
  planProductionRetry,
} from "@/lib/approvals/production-status";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { getSingleCompanyId } from "@/lib/config/single-company";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hobby ceiling is 60s (legacy Hobby default is ~10s without this).
 * Note: Creatomate branding poll can exceed 60s (~300s worst case) — still a
 * known Hobby gap; Pro or off-request polling needed for long composes.
 */
export const maxDuration = 60;

type RouteContext = {
  params: { id: string };
};

const retryLocks = new Set<string>();

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !isAllowedAppRole(sessionUser.role)) {
      return apiError("Unauthorized.", 401);
    }

    const postId = params.id;
    if (!postId) {
      return apiError("Post id is required.", 400);
    }

    if (retryLocks.has(postId)) {
      return apiError("A retry is already in progress for this post.", 409);
    }

    retryLocks.add(postId);

    try {
      const supabase = createAdminClient();
      const companyId = getSingleCompanyId();

      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .maybeSingle();

      if (postError) {
        return apiError(postError.message, 500);
      }

      if (!post) {
        return apiError("Post not found.", 404);
      }

      if (post.company_id !== companyId) {
        return apiError("Post does not belong to the authorised company.", 403);
      }

      if (!isRetryableProductionPost(post)) {
        return apiError("Post is not in a retryable failed production state.", 400);
      }

      const plan = planProductionRetry(post);
      const now = new Date().toISOString();
      const nextAttempts = (post.media_generation_attempts ?? 0) + 1;

      if (plan.resumeBrandingOnly && post.video_url) {
        try {
          if (process.env.CREATOMATE_API_KEY) {
            const brandedUrl = await composeVideo({
              videoUrl: post.video_url,
              postId: post.id,
              companyId: post.company_id,
              caption: post.caption ?? post.concept ?? "",
              platform: post.platform ?? "instagram",
            });

            const { data: brandedPost, error: brandedError } = await supabase
              .from("posts")
              .update({
                branded_video_url: brandedUrl,
                pipeline_stage: "ready",
                error_message: null,
                media_generation_attempts: nextAttempts,
                updated_at: now,
              })
              .eq("id", postId)
              .eq("pipeline_stage", "failed")
              .eq("company_id", companyId)
              .select("*")
              .maybeSingle();

            if (brandedError) {
              return apiError(brandedError.message, 500);
            }
            if (!brandedPost) {
              return apiError(
                "Post is no longer failed; another retry may be in progress.",
                409
              );
            }

            return apiSuccess({
              post: brandedPost,
              restartedFrom: "branding",
              message: "Video branding retried successfully.",
            });
          }

          const { data: readyPost, error: readyError } = await supabase
            .from("posts")
            .update({
              pipeline_stage: "ready",
              error_message: null,
              media_generation_attempts: nextAttempts,
              updated_at: now,
            })
            .eq("id", postId)
            .eq("pipeline_stage", "failed")
            .eq("company_id", companyId)
            .select("*")
            .maybeSingle();

          if (readyError) {
            return apiError(readyError.message, 500);
          }
          if (!readyPost) {
            return apiError(
              "Post is no longer failed; another retry may be in progress.",
              409
            );
          }

          return apiSuccess({
            post: readyPost,
            restartedFrom: "ready",
            message: "Post marked ready using existing video.",
          });
        } catch (brandError) {
          const message =
            brandError instanceof Error
              ? brandError.message
              : "Branding retry failed.";
          return apiError(message, 500);
        }
      }

      const updatePayload: {
        pipeline_stage: string;
        error_message: null;
        media_generation_attempts: number;
        updated_at: string;
        video_operation_id?: string | null;
      } = {
        pipeline_stage: plan.pipeline_stage,
        error_message: null,
        media_generation_attempts: nextAttempts,
        updated_at: now,
      };

      if (plan.clearVideoOperationId) {
        updatePayload.video_operation_id = null;
      }

      const { data: updatedPost, error: updateError } = await supabase
        .from("posts")
        .update(updatePayload)
        .eq("id", postId)
        .eq("pipeline_stage", "failed")
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();

      if (updateError) {
        return apiError(updateError.message, 500);
      }

      if (!updatedPost) {
        return apiError(
          "Post is no longer failed; another retry may be in progress.",
          409
        );
      }

      if (updatedPost.run_id) {
        void advanceRun(updatedPost.run_id).catch((err) => {
          console.error("[retry-production] advanceRun error:", err);
        });
      }

      return apiSuccess({
        post: updatedPost,
        restartedFrom: plan.pipeline_stage,
        message: "Production retry started.",
      });
    } finally {
      retryLocks.delete(postId);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retry production.";
    return apiError(message, 500);
  }
}
