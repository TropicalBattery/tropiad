"use client";

import { RefreshCw } from "lucide-react";

import { ProductionCard } from "@/components/dashboard/ProductionCard";
import { Button } from "@/components/ui/button";
import { summarizeProductionPosts } from "@/lib/approvals/production-status";
import type { Post } from "@/lib/supabase/types";

type ProductionQueueProps = {
  posts: Post[];
  weekStartByRunId: Record<string, string>;
  companySlug: string;
  isUpdating: boolean;
  isRefreshing: boolean;
  summaryLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  gate2Count: number;
  onRetry: (postId: string) => Promise<void>;
  onRefresh: () => void;
  onViewReady: () => void;
};

export function ProductionQueue({
  posts,
  weekStartByRunId,
  companySlug,
  isUpdating,
  isRefreshing,
  summaryLabel,
  emptyTitle,
  emptyDescription,
  gate2Count,
  onRetry,
  onRefresh,
  onViewReady,
}: ProductionQueueProps) {
  const summary = summarizeProductionPosts(posts);

  if (posts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <div className="surface-card border border-dashed border-border-subtle px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold text-text-primary">
            {emptyTitle}
          </p>
          {emptyDescription ? (
            <p className="mt-2 text-text-muted">{emptyDescription}</p>
          ) : null}
          {gate2Count > 0 ? (
            <Button
              type="button"
              className="mt-4"
              variant="outline"
              onClick={onViewReady}
            >
              View ready to publish
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">{summaryLabel}</p>
          <p className="text-xs text-text-muted">{summary.summary}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 justify-items-start gap-3 min-[640px]:grid-cols-[repeat(auto-fit,minmax(260px,360px))] min-[640px]:justify-start min-[640px]:gap-4">
        {posts.map((post) => (
          <ProductionCard
            key={post.id}
            post={post}
            weekStart={
              post.run_id ? weekStartByRunId[post.run_id] ?? null : null
            }
            companySlug={companySlug}
            disabled={isUpdating}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}
