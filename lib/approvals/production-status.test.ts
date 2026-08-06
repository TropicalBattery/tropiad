import { describe, expect, it } from "vitest";

import {
  buildRunProductionBreakdown,
  isInProduction,
  isRetryableProductionPost,
  planProductionRetry,
  resolveProductionStatus,
  summarizeProductionPosts,
} from "@/lib/approvals/production-status";
import type { Post } from "@/lib/supabase/types";

function makePost(overrides: Partial<Post> & { id: string }): Post {
  const { id, ...rest } = overrides;
  return {
    id,
    company_id: "company-1",
    platform: "Instagram",
    content_type: "Image",
    content_category: null,
    concept: "DIY: Clean Your Battery Terminals",
    caption: null,
    hashtags: [],
    image_url: null,
    video_url: null,
    video_operation_id: null,
    branded_video_url: null,
    scheduled_at: null,
    suggested_time_tag: null,
    suggested_scheduled_at: null,
    published_at: null,
    zernio_post_id: null,
    run_id: "run-1",
    gate1_status: "approved",
    gate2_status: "pending",
    gate1_reviewed_at: null,
    gate2_reviewed_at: null,
    edit_feedback: null,
    paperclip_job_id: null,
    pipeline_stage: "ideation",
    error_message: null,
    visual_prompt: null,
    media_provider: null,
    media_generation_attempts: 0,
    impressions: null,
    reach: null,
    engagement: null,
    clicks: null,
    analytics_pulled_at: null,
    featured_product_id: null,
    voice_over_script: null,
    overstock_recommendation_id: null,
    created_at: "2026-08-06T10:00:00.000Z",
    updated_at: "2026-08-06T10:30:00.000Z",
    ...rest,
  };
}

describe("production-status", () => {
  it("shows Gate 1 approved concepts under In production", () => {
    const post = makePost({ id: "p1", pipeline_stage: "ideation" });
    expect(isInProduction(post)).toBe(true);
  });

  it("does not show Gate 1 pending under In production", () => {
    const post = makePost({
      id: "p2",
      gate1_status: "pending",
      pipeline_stage: "ideation",
    });
    expect(isInProduction(post)).toBe(false);
  });

  it("maps caption-generation status", () => {
    const status = resolveProductionStatus(
      makePost({ id: "p3", pipeline_stage: "ideation" })
    );
    expect(status.key).toBe("generating_caption");
    expect(status.label).toBe("Generating caption");
  });

  it("maps image-generation status", () => {
    const status = resolveProductionStatus(
      makePost({
        id: "p4",
        content_type: "Image",
        pipeline_stage: "producing",
        caption: "Caption",
      })
    );
    expect(status.key).toBe("generating_image");
  });

  it("maps video-generation status", () => {
    const status = resolveProductionStatus(
      makePost({
        id: "p5",
        content_type: "Video",
        pipeline_stage: "producing",
        caption: "Caption",
        video_operation_id: "ops/123",
      })
    );
    expect(status.key).toBe("generating_video");
  });

  it("maps Creatomate branding status", () => {
    const status = resolveProductionStatus(
      makePost({
        id: "p6",
        content_type: "Video",
        pipeline_stage: "producing",
        caption: "Caption",
        video_url: "https://example.com/v.mp4",
        branded_video_url: null,
      })
    );
    expect(status.key).toBe("applying_branding");
  });

  it("keeps failed posts visible and retryable", () => {
    const post = makePost({
      id: "p7",
      pipeline_stage: "failed",
      error_message: "Video kickoff failed",
      media_generation_attempts: 1,
    });
    expect(isInProduction(post)).toBe(true);
    expect(resolveProductionStatus(post).key).toBe("failed");
    expect(isRetryableProductionPost(post)).toBe(true);
  });

  it("keeps awaiting-connection posts visible", () => {
    const post = makePost({
      id: "p8",
      pipeline_stage: "awaiting_connection",
    });
    expect(isInProduction(post)).toBe(true);
    expect(resolveProductionStatus(post).key).toBe("awaiting_connection");
  });

  it("moves successful ready posts out of production", () => {
    const post = makePost({
      id: "p9",
      pipeline_stage: "ready",
      gate2_status: "pending",
      caption: "Ready",
    });
    expect(isInProduction(post)).toBe(false);
  });

  it("summarizes production counts", () => {
    const summary = summarizeProductionPosts([
      makePost({ id: "a", pipeline_stage: "producing", caption: "x" }),
      makePost({ id: "b", pipeline_stage: "failed" }),
      makePost({ id: "c", pipeline_stage: "awaiting_connection" }),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.generating).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.awaitingConnection).toBe(1);
  });

  it("plans caption restart when caption is missing", () => {
    expect(planProductionRetry(makePost({ id: "r1" })).pipeline_stage).toBe(
      "ideation"
    );
  });

  it("plans visual restart for media failures with caption", () => {
    expect(
      planProductionRetry(
        makePost({
          id: "r2",
          caption: "Caption",
          pipeline_stage: "failed",
        })
      ).pipeline_stage
    ).toBe("visual");
  });

  it("plans branding-only retry when raw video exists", () => {
    const plan = planProductionRetry(
      makePost({
        id: "r3",
        content_type: "Video",
        caption: "Caption",
        video_url: "https://example.com/v.mp4",
        pipeline_stage: "failed",
      })
    );
    expect(plan.resumeBrandingOnly).toBe(true);
    expect(plan.pipeline_stage).toBe("producing");
  });

  it("builds cycle production breakdown for Cycles page", () => {
    const breakdown = buildRunProductionBreakdown([
      makePost({ id: "c1", pipeline_stage: "ready" }),
      makePost({ id: "c2", pipeline_stage: "producing", caption: "x" }),
      makePost({ id: "c3", pipeline_stage: "failed" }),
      makePost({ id: "c4", pipeline_stage: "awaiting_connection" }),
    ]);
    expect(breakdown.completed).toHaveLength(1);
    expect(breakdown.generating).toHaveLength(1);
    expect(breakdown.failed).toHaveLength(1);
    expect(breakdown.awaitingConnection).toHaveLength(1);
    expect(breakdown.summary).toContain("completed");
  });
});
