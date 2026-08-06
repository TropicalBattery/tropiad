import {
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { ContentRun, Post, RunStep } from "@/lib/supabase/types";
import { getRunStatusBadgeClass as getRunStatusBadgeClassFromTheme } from "@/lib/constants/theme-colors";

export type ContentMixPercentages = {
  educational: number;
  promotional: number;
  engagement: number;
} | null;

export function buildContentMixPercentages(
  rows: { content_category: string | null }[]
): ContentMixPercentages {
  const counts = { educational: 0, promotional: 0, engagement: 0 };

  rows.forEach((post) => {
    const category = post.content_category?.toLowerCase();
    if (category === "educational") {
      counts.educational += 1;
    } else if (category === "promotional") {
      counts.promotional += 1;
    } else if (category === "engagement") {
      counts.engagement += 1;
    }
  });

  const total = counts.educational + counts.promotional + counts.engagement;

  if (total === 0) {
    return null;
  }

  return {
    educational: Math.round((counts.educational / total) * 100),
    promotional: Math.round((counts.promotional / total) * 100),
    engagement: Math.round((counts.engagement / total) * 100),
  };
}

export function isReadyToPublish(post: Post): boolean {
  return (
    post.gate2_status === "approved" && post.pipeline_stage !== "published"
  );
}

export function isGate2PendingApproval(post: Post): boolean {
  return (
    post.gate1_status === "approved" &&
    post.gate2_status === "pending" &&
    post.pipeline_stage === "ready"
  );
}

export function isAwaitingReview(post: Post): boolean {
  return post.gate1_status === "pending" || post.gate2_status === "pending";
}

export function isScheduledThisWeek(
  scheduledAt: string | null,
  date = new Date()
): boolean {
  if (!scheduledAt) {
    return false;
  }

  const scheduledDate = new Date(scheduledAt);
  return isWithinInterval(scheduledDate, {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  });
}

export function isPublishedThisMonth(
  publishedAt: string | null,
  date = new Date()
): boolean {
  if (!publishedAt) {
    return false;
  }

  const publishedDate = new Date(publishedAt);
  return isWithinInterval(publishedDate, {
    start: startOfMonth(date),
    end: endOfMonth(date),
  });
}

export function getPipelineStageIndex(
  run: ContentRun | null,
  steps: RunStep[],
  posts: Post[]
): number {
  if (!run) {
    return -1;
  }

  if (run.status === "complete") {
    return 6;
  }

  if (run.status === "publishing") {
    return 5;
  }

  if (run.status === "gate2_pending") {
    return 4;
  }

  if (run.status === "gate1_pending") {
    const runPosts = posts.filter((post) => post.run_id === run.id);
    const inProduction = runPosts.some(
      (post) =>
        post.gate1_status === "approved" &&
        ["copywriting", "visual", "ready"].includes(post.pipeline_stage)
    );

    return inProduction ? 3 : 2;
  }

  if (run.status === "pending" || run.status === "running") {
    const trendStep = steps.find((step) => step.step_name === "trend_research");
    const ideationStep = steps.find((step) => step.step_name === "ideation");

    if (ideationStep?.status === "running") {
      return 1;
    }

    if (ideationStep?.status === "succeeded") {
      return 2;
    }

    if (trendStep?.status === "succeeded") {
      return 1;
    }

    if (trendStep?.status === "running") {
      return 0;
    }

    return 0;
  }

  return -1;
}

export function getRunStatusBadgeClass(status: string): string {
  return getRunStatusBadgeClassFromTheme(status);
}
