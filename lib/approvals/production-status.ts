import { formatDistanceStrict } from "date-fns";

import type { Post } from "@/lib/supabase/types";

export type ProductionStatusKey =
  | "generating_caption"
  | "preparing_media"
  | "generating_image"
  | "generating_video"
  | "applying_branding"
  | "preparing_final_approval"
  | "awaiting_connection"
  | "failed"
  | "copywriting";

export type ProductionStatusView = {
  key: ProductionStatusKey;
  label: string;
  description: string;
  tone: "neutral" | "progress" | "warning" | "danger";
};

const PRODUCTION_STAGES = new Set([
  "ideation",
  "copywriting",
  "visual",
  "producing",
  "failed",
  "awaiting_connection",
]);

function isVideoContentType(contentType: string): boolean {
  return contentType.trim().toLowerCase() === "video";
}

/**
 * Gate 1 approved, not yet Gate 2 approved, and still in a production-related stage.
 * `ready` + gate2 pending belongs in Gate 2, not here.
 */
export function isInProduction(post: Post): boolean {
  if (post.gate1_status !== "approved") {
    return false;
  }

  if (post.gate2_status === "approved") {
    return false;
  }

  if (
    post.pipeline_stage === "published" ||
    post.pipeline_stage === "rejected"
  ) {
    return false;
  }

  if (post.pipeline_stage === "ready" && post.gate2_status === "pending") {
    return false;
  }

  // Ready but Gate 2 not prepared (inconsistent) — keep visible in production.
  if (post.pipeline_stage === "ready") {
    return true;
  }

  return PRODUCTION_STAGES.has(post.pipeline_stage);
}

export function resolveProductionStatus(post: Post): ProductionStatusView {
  const stage = post.pipeline_stage;
  const isVideo = isVideoContentType(post.content_type);

  if (stage === "failed") {
    return {
      key: "failed",
      label: "Production failed",
      description:
        "Production could not be completed. Review the error and retry the post.",
      tone: "danger",
    };
  }

  if (stage === "awaiting_connection") {
    return {
      key: "awaiting_connection",
      label: "Social account connection required",
      description: `Connect the required ${post.platform} account before this post can continue.`,
      tone: "warning",
    };
  }

  if (stage === "ready") {
    return {
      key: "preparing_final_approval",
      label: "Preparing final approval",
      description:
        "Production completed, but final approval has not been prepared.",
      tone: "warning",
    };
  }

  if (stage === "copywriting") {
    return {
      key: "copywriting",
      label: "Updating caption",
      description: "The caption is being revised from your edit feedback.",
      tone: "progress",
    };
  }

  if (stage === "ideation") {
    return {
      key: "generating_caption",
      label: "Generating caption",
      description: "The caption and hashtags are being created.",
      tone: "progress",
    };
  }

  if (stage === "visual") {
    return {
      key: "preparing_media",
      label: "Preparing media",
      description: "The system is preparing the image or video instructions.",
      tone: "progress",
    };
  }

  if (stage === "producing") {
    if (isVideo && post.video_url && !post.branded_video_url) {
      return {
        key: "applying_branding",
        label: "Applying video branding",
        description:
          "The video is complete and the Tropical Battery branding is being applied.",
        tone: "progress",
      };
    }

    if (isVideo) {
      return {
        key: "generating_video",
        label: "Generating video",
        description:
          "Video generation can take several minutes. The status updates automatically.",
        tone: "progress",
      };
    }

    return {
      key: "generating_image",
      label: "Generating image",
      description:
        "The image is being generated and will move to final approval when complete.",
      tone: "progress",
    };
  }

  return {
    key: "preparing_media",
    label: "In production",
    description: "This post is still being prepared.",
    tone: "neutral",
  };
}

export function isRetryableProductionPost(post: Post): boolean {
  return (
    post.gate1_status === "approved" &&
    post.gate2_status !== "approved" &&
    post.pipeline_stage === "failed"
  );
}

export type ProductionRetryPlan = {
  pipeline_stage: "ideation" | "visual" | "producing";
  clearVideoOperationId: boolean;
  resumeBrandingOnly: boolean;
};

export function planProductionRetry(post: Post): ProductionRetryPlan {
  const isVideo = isVideoContentType(post.content_type);

  if (!post.caption) {
    return {
      pipeline_stage: "ideation",
      clearVideoOperationId: true,
      resumeBrandingOnly: false,
    };
  }

  if (isVideo && post.video_url) {
    return {
      pipeline_stage: "producing",
      clearVideoOperationId: false,
      resumeBrandingOnly: true,
    };
  }

  if (isVideo && post.video_operation_id && !post.video_url) {
    return {
      pipeline_stage: "producing",
      clearVideoOperationId: false,
      resumeBrandingOnly: false,
    };
  }

  return {
    pipeline_stage: "visual",
    clearVideoOperationId: true,
    resumeBrandingOnly: false,
  };
}

export function summarizeProductionPosts(posts: Post[]): {
  total: number;
  generating: number;
  awaitingConnection: number;
  failed: number;
  summary: string;
} {
  let generating = 0;
  let awaitingConnection = 0;
  let failed = 0;

  for (const post of posts) {
    const status = resolveProductionStatus(post);
    if (status.key === "failed") {
      failed += 1;
    } else if (status.key === "awaiting_connection") {
      awaitingConnection += 1;
    } else {
      generating += 1;
    }
  }

  const parts: string[] = [];
  if (generating > 0) {
    parts.push(`${generating} generating`);
  }
  if (awaitingConnection > 0) {
    parts.push(
      `${awaitingConnection} waiting for connection`
    );
  }
  if (failed > 0) {
    parts.push(`${failed} failed`);
  }

  return {
    total: posts.length,
    generating,
    awaitingConnection,
    failed,
    summary:
      parts.length > 0
        ? parts.join(" · ")
        : `${posts.length} post${posts.length === 1 ? "" : "s"} in production`,
  };
}

export function formatElapsedLabel(
  fromIso: string | null | undefined,
  to: Date = new Date()
): string | null {
  if (!fromIso) {
    return null;
  }
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) {
    return null;
  }
  return formatDistanceStrict(from, to, { addSuffix: false });
}

export function conceptTitle(post: Post, maxLength = 72): string {
  const raw = (post.concept ?? "Untitled concept").trim();
  if (raw.length <= maxLength) {
    return raw;
  }
  return `${raw.slice(0, maxLength - 1).trimEnd()}…`;
}

export type RunProductionBreakdown = {
  generating: Post[];
  completed: Post[];
  failed: Post[];
  awaitingConnection: Post[];
  summary: string;
};

export function buildRunProductionBreakdown(posts: Post[]): RunProductionBreakdown {
  const generating: Post[] = [];
  const completed: Post[] = [];
  const failed: Post[] = [];
  const awaitingConnection: Post[] = [];

  for (const post of posts) {
    if (post.gate1_status !== "approved") {
      continue;
    }

    if (
      post.pipeline_stage === "ready" ||
      post.pipeline_stage === "published" ||
      post.gate2_status === "approved"
    ) {
      if (post.pipeline_stage !== "failed") {
        completed.push(post);
      }
      continue;
    }

    if (post.pipeline_stage === "failed") {
      failed.push(post);
      continue;
    }

    if (post.pipeline_stage === "awaiting_connection") {
      awaitingConnection.push(post);
      continue;
    }

    if (isInProduction(post)) {
      generating.push(post);
    }
  }

  const parts: string[] = [];
  if (completed.length > 0) {
    parts.push(`${completed.length} completed`);
  }
  if (generating.length > 0) {
    parts.push(`${generating.length} generating`);
  }
  if (failed.length > 0) {
    parts.push(`${failed.length} failed`);
  }
  if (awaitingConnection.length > 0) {
    parts.push(`${awaitingConnection.length} waiting for connection`);
  }

  return {
    generating,
    completed,
    failed,
    awaitingConnection,
    summary: parts.join(" · ") || "No production activity yet",
  };
}
