import { describe, expect, it } from "vitest";

import {
  ALL_PENDING_RUN_VALUE,
  buildApprovalCycleOptions,
  buildCycleSummary,
  filterPostsForRunSelection,
  formatWeekOfLabel,
  groupPostsByCycle,
  isValidRunIdParam,
  olderUnresolvedPendingCount,
  oldestUnresolvedRunId,
  resolveApprovalTab,
  resolveNextRunSelection,
  resolveRunSelection,
  uniqueCycleCountForPosts,
} from "@/lib/approvals/approval-cycles";
import type { Post } from "@/lib/supabase/types";

function makePost(overrides: Partial<Post> & { id: string }): Post {
  const { id, ...rest } = overrides;
  return {
    id,
    company_id: "company-1",
    platform: "Instagram",
    content_type: "Image",
    content_category: null,
    concept: "Concept",
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
    run_id: null,
    gate1_status: "pending",
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
    created_at: "2026-08-10T12:00:00.000Z",
    updated_at: "2026-08-10T12:00:00.000Z",
    ...rest,
  };
}

const CURRENT_WEEK = "2026-08-10";

describe("approval-cycles", () => {
  const runs = [
    { id: "run-current", week_start: "2026-08-10" },
    { id: "run-older", week_start: "2026-08-03" },
    { id: "run-oldest", week_start: "2026-07-27" },
  ];

  const posts = [
    makePost({
      id: "p1",
      run_id: "run-current",
      gate1_status: "pending",
      gate2_status: "pending",
      pipeline_stage: "ideation",
    }),
    makePost({
      id: "p2",
      run_id: "run-current",
      gate1_status: "approved",
      gate2_status: "pending",
      pipeline_stage: "ready",
    }),
    makePost({
      id: "p3",
      run_id: "run-older",
      gate1_status: "pending",
      gate2_status: "pending",
      pipeline_stage: "ideation",
    }),
    makePost({
      id: "p4",
      run_id: "run-oldest",
      gate1_status: "approved",
      gate2_status: "pending",
      pipeline_stage: "ready",
    }),
    makePost({
      id: "p5",
      run_id: "run-current",
      gate1_status: "approved",
      gate2_status: "approved",
      pipeline_stage: "published",
    }),
  ];

  it("defaults to the newest active cycle preferring the current week", () => {
    const options = buildApprovalCycleOptions(posts, runs, CURRENT_WEEK);
    expect(resolveRunSelection(options, null)).toBe("run-current");
    expect(options[0].runId).toBe("run-current");
    expect(options[0].isCurrent).toBe(true);
  });

  it("selects an older cycle when requested via url", () => {
    const options = buildApprovalCycleOptions(posts, runs, CURRENT_WEEK);
    expect(resolveRunSelection(options, "run-older")).toBe("run-older");
  });

  it("filters Gate 1 posts by run_id", () => {
    const filtered = filterPostsForRunSelection(posts, "run-current", "gate1");
    expect(filtered.map((post) => post.id)).toEqual(["p1"]);
  });

  it("filters Gate 2 posts by run_id (ready only)", () => {
    const filtered = filterPostsForRunSelection(posts, "run-current", "gate2");
    expect(filtered.map((post) => post.id)).toEqual(["p2"]);
  });

  it("keeps producing posts out of Gate 2 and in production", () => {
    const producing = makePost({
      id: "prod",
      run_id: "run-current",
      gate1_status: "approved",
      gate2_status: "pending",
      pipeline_stage: "producing",
      caption: "Caption",
    });
    const withProducing = [...posts, producing];
    expect(
      filterPostsForRunSelection(withProducing, "run-current", "gate2").map(
        (post) => post.id
      )
    ).toEqual(["p2"]);
    expect(
      filterPostsForRunSelection(
        withProducing,
        "run-current",
        "production"
      ).map((post) => post.id)
    ).toEqual(["prod"]);
  });

  it("groups all-pending posts newest to oldest", () => {
    const options = buildApprovalCycleOptions(posts, runs, CURRENT_WEEK);
    const gate1 = filterPostsForRunSelection(
      posts,
      ALL_PENDING_RUN_VALUE,
      "gate1"
    );
    const groups = groupPostsByCycle(gate1, options);
    expect(groups.map((group) => group.option.runId)).toEqual([
      "run-current",
      "run-older",
    ]);
    expect(groups[0].posts.map((post) => post.id)).toEqual(["p1"]);
  });

  it("scopes approve-all candidates to selected cycle and gate", () => {
    const gate2 = filterPostsForRunSelection(posts, "run-older", "gate2");
    expect(gate2).toHaveLength(0);

    const gate1 = filterPostsForRunSelection(posts, "run-older", "gate1");
    expect(gate1.map((post) => post.id)).toEqual(["p3"]);
  });

  it("approve-all visible spans multiple cycles only for all pending", () => {
    const gate2 = filterPostsForRunSelection(
      posts,
      ALL_PENDING_RUN_VALUE,
      "gate2"
    );
    expect(gate2.map((post) => post.id).sort()).toEqual(["p2", "p4"]);
    const options = buildApprovalCycleOptions(posts, runs, CURRENT_WEEK);
    expect(uniqueCycleCountForPosts(gate2, options)).toBe(2);
  });

  it("removes a completed cycle from selector options", () => {
    const remaining = posts.filter((post) => post.run_id !== "run-oldest");
    const options = buildApprovalCycleOptions(remaining, runs, CURRENT_WEEK);
    expect(options.map((option) => option.runId)).toEqual([
      "run-current",
      "run-older",
    ]);
  });

  it("automatically selects the next available cycle", () => {
    const withoutCurrent = posts.filter(
      (post) => post.run_id !== "run-current"
    );
    const options = buildApprovalCycleOptions(
      withoutCurrent,
      runs,
      CURRENT_WEEK
    );
    expect(resolveNextRunSelection(options, "run-current")).toBe("run-older");
  });

  it("computes older-cycle warning count", () => {
    const options = buildApprovalCycleOptions(posts, runs, CURRENT_WEEK);
    expect(olderUnresolvedPendingCount(options, "run-current")).toBe(2);
    expect(oldestUnresolvedRunId(options)).toBe("run-oldest");
    expect(olderUnresolvedPendingCount(options, "run-older")).toBe(0);
  });

  it("builds empty-friendly cycle summaries", () => {
    const options = buildApprovalCycleOptions(posts, runs, CURRENT_WEEK);
    expect(
      buildCycleSummary({
        selection: "run-current",
        options,
        gate: "gate1",
        visibleGateCount: 1,
      })
    ).toBe("Current cycle · 1 of 2 concepts awaiting Gate 1 review");

    expect(
      buildCycleSummary({
        selection: "run-oldest",
        options,
        gate: "gate2",
        visibleGateCount: 1,
      })
    ).toBe("Overdue cycle · 1 posts ready for final approval");
  });

  it("rejects invalid or unauthorised runId values", () => {
    const allowed = new Set(["run-current", "run-older"]);
    expect(isValidRunIdParam("all", allowed)).toBe(true);
    expect(isValidRunIdParam("run-current", allowed)).toBe(true);
    expect(isValidRunIdParam("run-foreign", allowed)).toBe(false);
  });

  it("formats week labels without exposing ids", () => {
    expect(formatWeekOfLabel("2026-08-10")).toBe("Week of Aug 10, 2026");
  });

  it("excludes cycles with no actionable pending posts", () => {
    const options = buildApprovalCycleOptions(
      [
        makePost({
          id: "done",
          run_id: "run-current",
          gate1_status: "approved",
          gate2_status: "approved",
          pipeline_stage: "published",
        }),
      ],
      runs,
      CURRENT_WEEK
    );
    expect(options).toHaveLength(0);
    expect(resolveRunSelection(options, null)).toBe(ALL_PENDING_RUN_VALUE);
  });

  it("maps tab query values for production URLs", () => {
    expect(resolveApprovalTab("production")).toBe("production");
    expect(resolveApprovalTab("posts")).toBe("gate2");
    expect(resolveApprovalTab("concepts")).toBe("gate1");
  });
});
