import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: {
    id: string;
  };
};

const rejectBodySchema = z
  .object({
    gate: z.enum(["gate1", "gate2"]),
    reasons: z.array(z.string()).default([]),
    freeText: z.string().optional(),
  })
  .superRefine((body, context) => {
    const hasReasons = body.reasons.length > 0;
    const hasFreeText = Boolean(body.freeText?.trim());

    if (!hasReasons && !hasFreeText) {
      context.addIssue({
        code: "custom",
        message: "At least one reason or free text is required.",
        path: ["reasons"],
      });
    }
  });

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const parsed = rejectBodySchema.safeParse(await request.json());

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid rejection payload.";
      return apiError(message, 400);
    }

    const { gate, reasons, freeText } = parsed.data;
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, company_id, concept, caption")
      .eq("id", params.id)
      .single();

    if (postError || !post) {
      return apiError(postError?.message ?? "Post not found.", 404);
    }

    const postUpdates =
      gate === "gate1"
        ? {
            gate1_status: "rejected",
            pipeline_stage: "rejected",
            gate1_reviewed_at: now,
            updated_at: now,
          }
        : {
            gate2_status: "rejected",
            pipeline_stage: "rejected",
            gate2_reviewed_at: now,
            updated_at: now,
          };

    const { error: updateError } = await supabase
      .from("posts")
      .update(postUpdates)
      .eq("id", params.id);

    if (updateError) {
      return apiError(updateError.message, 500);
    }

    const { error: feedbackError } = await supabase
      .from("rejection_feedback")
      .insert({
        company_id: post.company_id,
        post_id: params.id,
        gate,
        reasons,
        free_text: freeText?.trim() ? freeText.trim() : null,
        concept_snapshot: post.concept,
        caption_snapshot: post.caption,
      });

    if (feedbackError) {
      return apiError(feedbackError.message, 500);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reject post.";
    return apiError(message, 500);
  }
}
