"use client";

import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  conceptTitle,
  formatElapsedLabel,
  resolveProductionStatus,
  type ProductionStatusView,
} from "@/lib/approvals/production-status";
import { formatWeekOfLabel } from "@/lib/approvals/approval-cycles";
import type { Post } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type ProductionCardProps = {
  post: Post;
  weekStart: string | null;
  companySlug: string;
  disabled: boolean;
  onRetry: (postId: string) => Promise<void>;
};

function statusBadgeVariant(
  tone: ProductionStatusView["tone"]
): "default" | "secondary" | "success" | "danger" | "outline" {
  if (tone === "danger") return "danger";
  if (tone === "warning") return "outline";
  if (tone === "progress") return "default";
  return "secondary";
}

export function ProductionCard({
  post,
  weekStart,
  companySlug,
  disabled,
  onRetry,
}: ProductionCardProps) {
  const status = resolveProductionStatus(post);
  const startedAt = post.gate1_reviewed_at ?? post.created_at;
  const elapsed = formatElapsedLabel(startedAt);
  const isFailed = status.key === "failed";
  const needsConnection = status.key === "awaiting_connection";

  return (
    <article className="flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white dark:border-[#2a2a2a] dark:bg-[#161616]">
      <div className="relative aspect-square w-full overflow-hidden bg-bg-surface-hover">
        {post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : post.video_url || post.branded_video_url ? (
          <video
            src={post.branded_video_url ?? post.video_url ?? undefined}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Loader2
              className={cn(
                "h-6 w-6 text-text-muted",
                status.tone === "progress" && "animate-spin"
              )}
              aria-hidden
            />
            <p className="text-xs text-text-muted">{status.label}</p>
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
          {status.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <PlatformBadge platform={post.platform} />
          <Badge variant="secondary">{post.content_type}</Badge>
          <Badge variant={statusBadgeVariant(status.tone)}>
            {isFailed ? "Failed" : status.label}
          </Badge>
        </div>

        <p className="text-sm font-medium leading-snug text-text-primary">
          {conceptTitle(post)}
        </p>

        {weekStart ? (
          <p className="text-xs text-text-muted">{formatWeekOfLabel(weekStart)}</p>
        ) : null}

        <p className="text-xs text-text-muted">{status.description}</p>

        {post.caption ? (
          <p className="line-clamp-3 text-xs text-[#6B7280]">{post.caption}</p>
        ) : null}

        <div className="mt-1 space-y-0.5 text-[11px] text-text-muted">
          {startedAt ? (
            <p>
              Started:{" "}
              {format(new Date(startedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          ) : null}
          <p>
            Last updated: {format(new Date(post.updated_at), "h:mm a")}
          </p>
          {elapsed ? <p>Elapsed: {elapsed}</p> : null}
          {isFailed && post.media_generation_attempts > 0 ? (
            <p>Attempts: {post.media_generation_attempts}</p>
          ) : null}
        </div>

        {isFailed && post.error_message ? (
          <details className="rounded-lg border border-border-subtle bg-bg-surface-hover p-2 text-xs">
            <summary className="cursor-pointer text-text-muted">
              Technical details
            </summary>
            <p className="mt-1 break-words text-[#6B7280]">
              {post.error_message.slice(0, 280)}
            </p>
          </details>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {isFailed ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => void onRetry(post.id)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry production
            </Button>
          ) : null}
          {needsConnection ? (
            <Button type="button" size="sm" variant="outline" asChild>
              <Link
                href={`/dashboard/${companySlug}/settings?tab=accounts`}
              >
                Connect account
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
