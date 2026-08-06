"use client";

import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { PostCard } from "@/components/dashboard/PostCard";
import type { Post } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Gate2QueueProps = {
  posts: Post[];
  companyName: string;
  onApprove: (postId: string) => Promise<void>;
  onPublishNow: (postId: string) => Promise<void>;
  onReject: (post: Post) => void;
  onRequestEdit: (postId: string, feedback: string) => Promise<void>;
  isUpdating: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

type Gate2VisualState =
  | "ready"
  | "failed"
  | "processing_video"
  | "processing_image"
  | "preparing_video";

function isVideoContentType(contentType: string): boolean {
  return contentType.trim().toLowerCase() === "video";
}

function getGate2VisualState(post: Post): Gate2VisualState {
  if (post.pipeline_stage === "failed") {
    return "failed";
  }

  if (
    post.pipeline_stage === "producing" &&
    post.error_message &&
    post.error_message.trim().length > 0
  ) {
    return "failed";
  }

  if (post.pipeline_stage === "producing") {
    const isVideo = isVideoContentType(post.content_type);

    if (isVideo && post.video_operation_id) {
      return "processing_video";
    }

    if (isVideo && !post.video_operation_id) {
      return "preparing_video";
    }

    return "processing_image";
  }

  return "ready";
}

function QueueCardShell({
  post,
  badgeLabel,
  badgeClassName,
  children,
  footer,
}: {
  post: Post;
  badgeLabel: string;
  badgeClassName: string;
  children: ReactNode;
  footer: string;
}) {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <PlatformBadge platform={post.platform} />
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            badgeClassName
          )}
        >
          {badgeLabel}
        </span>
      </div>
      {children}
      <p className="line-clamp-2 text-sm text-[#6b7280]">
        {post.concept ?? "No concept provided."}
      </p>
      <div className="w-full rounded-lg border border-[#E5E7EB] py-2 text-center text-xs text-[#6B7280]">
        {footer}
      </div>
    </div>
  );
}

function ProcessingCard({
  post,
  label,
}: {
  post: Post;
  label: string;
}) {
  return (
    <QueueCardShell
      post={post}
      badgeLabel="Generating..."
      badgeClassName="border-[#F5A000]/40 bg-[#FFFBEB] text-[#B45309]"
      footer="Available for approval once ready"
    >
      <div className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg bg-[#f8fafc]">
        <Loader2 size={20} className="animate-spin text-[#CC2B2B]" />
        <p className="text-xs text-[#9ca3af]">{label}</p>
      </div>
    </QueueCardShell>
  );
}

function PreparingVideoCard({ post }: { post: Post }) {
  return (
    <QueueCardShell
      post={post}
      badgeLabel="Preparing..."
      badgeClassName="border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]"
      footer="Available for approval once ready"
    >
      <div className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg bg-[#f8fafc]">
        <span
          className="h-2 w-2 animate-pulse rounded-full bg-[#F5A000]"
          aria-hidden
        />
        <p className="text-xs text-[#9ca3af]">Preparing video...</p>
      </div>
    </QueueCardShell>
  );
}

function FailedVisualCard({ post }: { post: Post }) {
  return (
    <QueueCardShell
      post={post}
      badgeLabel="Failed"
      badgeClassName="border-[#FECACA] bg-[#FEF2F2] text-[#CC2B2B]"
      footer="Can be regenerated on the next run"
    >
      <div className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#FECACA]/60 bg-[#fdf2f2] px-4 text-center">
        <AlertCircle className="h-5 w-5 text-[#CC2B2B]" aria-hidden />
        <p className="text-sm font-medium text-[#111111]">
          Video generation failed
        </p>
        {post.error_message ? (
          <p className="line-clamp-3 text-xs text-[#6B7280]">
            {post.error_message}
          </p>
        ) : null}
      </div>
    </QueueCardShell>
  );
}

export function Gate2Queue({
  posts,
  companyName,
  onApprove,
  onPublishNow,
  onReject,
  onRequestEdit,
  isUpdating,
  emptyTitle = "No posts are ready for final approval in this cycle.",
  emptyDescription,
}: Gate2QueueProps) {
  if (posts.length === 0) {
    return (
      <div className="surface-card border border-dashed border-border-subtle px-6 py-16 text-center">
        <p className="font-display text-lg font-semibold text-text-primary">
          {emptyTitle}
        </p>
        {emptyDescription ? (
          <p className="mt-2 text-text-muted">{emptyDescription}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 justify-items-start gap-3 min-[640px]:grid-cols-[repeat(auto-fit,minmax(260px,360px))] min-[640px]:justify-start min-[640px]:gap-4">
      {posts.map((post) => {
        const state = getGate2VisualState(post);

        if (state === "failed") {
          return <FailedVisualCard key={post.id} post={post} />;
        }

        if (state === "processing_video") {
          return (
            <ProcessingCard
              key={post.id}
              post={post}
              label="Generating video..."
            />
          );
        }

        if (state === "preparing_video") {
          return <PreparingVideoCard key={post.id} post={post} />;
        }

        if (state === "processing_image") {
          return (
            <ProcessingCard
              key={post.id}
              post={post}
              label="Creating your visual..."
            />
          );
        }

        return (
          <PostCard
            key={post.id}
            post={post}
            companyName={companyName}
            disabled={isUpdating}
            onApprove={onApprove}
            onPublishNow={onPublishNow}
            onReject={onReject}
            onRequestEdit={onRequestEdit}
          />
        );
      })}
    </div>
  );
}
