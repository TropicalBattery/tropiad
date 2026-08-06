import Link from "next/link";
import { Play, Sparkles } from "lucide-react";

import { ContentTypeBadge } from "@/components/dashboard/PlatformBadge";
import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/supabase/types";

type ReadyForApprovalPreviewCardProps = {
  post: Post;
  companyName: string;
  reviewHref: string;
};

function getCompanyInitial(name: string) {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || "?";
}

function PreviewMedia({ post }: { post: Post }) {
  if (post.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.image_url}
        alt=""
        className="h-full w-full object-cover"
      />
    );
  }

  if (post.video_url) {
    return (
      <>
        <video
          src={post.video_url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            <Play className="h-4 w-4 fill-white text-[#111111] dark:text-white" />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-surface-hover">
      <Sparkles className="h-8 w-8 text-text-muted" aria-hidden />
    </div>
  );
}

export function ReadyForApprovalPreviewCard({
  post,
  companyName,
  reviewHref,
}: ReadyForApprovalPreviewCardProps) {
  const caption = post.caption ?? post.concept ?? "No caption provided.";
  const platformLabel = post.platform.toUpperCase();

  return (
    <article className="surface-card flex w-full max-w-sm flex-col overflow-hidden">
      <div className="relative h-48 max-h-48 w-full overflow-hidden rounded-t-[15px] bg-bg-surface-hover">
        <PreviewMedia post={post} />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-accent-teal backdrop-blur-sm">
          GATE 2 - READY
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(204,43,43,0.18)] text-[10px] font-semibold text-accent-violet"
            >
              {getCompanyInitial(companyName)}
            </div>
            <span className="truncate text-xs font-medium uppercase tracking-wide text-text-muted">
              {platformLabel}
            </span>
          </div>
          <ContentTypeBadge contentType={post.content_type} />
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-snug text-text-primary">
          {caption}
        </p>

        <Button asChild className="mt-3 w-full" size="sm">
          <Link href={reviewHref}>Review</Link>
        </Button>
      </div>
    </article>
  );
}
