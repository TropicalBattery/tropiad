import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostInsert } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const companyId = searchParams.get("company_id");
    const gate1Status = searchParams.get("gate1_status");
    const gate2Status = searchParams.get("gate2_status");
    const pipelineStage = searchParams.get("pipeline_stage");
    const runId = searchParams.get("runId");

    if (!companyId) {
      return apiError("company_id query parameter is required.", 400);
    }

    const supabase = createAdminClient();

    if (runId) {
      const { data: run, error: runError } = await supabase
        .from("content_runs")
        .select("id")
        .eq("id", runId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (runError) {
        return apiError(runError.message, 500);
      }

      if (!run) {
        return apiError("runId was not found for this company.", 400);
      }
    }

    let query = supabase
      .from("posts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (gate1Status) {
      query = query.eq("gate1_status", gate1Status);
    }

    if (gate2Status) {
      query = query.eq("gate2_status", gate2Status);
    }

    if (pipelineStage) {
      query = query.eq("pipeline_stage", pipelineStage);
    }

    if (runId) {
      query = query.eq("run_id", runId);
    }

    const { data, error } = await query;

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess(data ?? []);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch posts.";
    return apiError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<PostInsert>;

    if (!body.company_id || !body.platform || !body.content_type) {
      return apiError(
        "company_id, platform, and content_type are required.",
        400
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        company_id: body.company_id,
        platform: body.platform,
        content_type: body.content_type,
        concept: body.concept ?? null,
        caption: body.caption ?? null,
        hashtags: body.hashtags ?? [],
        image_url: body.image_url ?? null,
        video_url: body.video_url ?? null,
        branded_video_url: body.branded_video_url ?? null,
        scheduled_at: body.scheduled_at ?? null,
        gate1_status: body.gate1_status ?? "pending",
        gate2_status: body.gate2_status ?? "pending",
        pipeline_stage: body.pipeline_stage ?? "ideation",
      })
      .select("*")
      .single();

    if (error || !data) {
      return apiError(error?.message ?? "Failed to create post.", 500);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create post.";
    return apiError(message, 500);
  }
}
