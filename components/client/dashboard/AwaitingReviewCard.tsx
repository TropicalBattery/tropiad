import Link from "next/link";
import { Film, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type AwaitingReviewCardProps = {
  post: Post;
  reviewHref: string;
};

function PostThumbnail({ post }: { post: Post }) {
  if (post.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.image_url}
        alt=""
        className="h-16 w-16 shrink-0 rounded-lg object-cover"
      />
    );
  }

  if (post.video_url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f8fafc] dark:bg-[#1f1f1f]">
        <Film className="h-5 w-5 text-[#06b6d4]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f8fafc] dark:bg-[#1f1f1f]">
      <Sparkles className="h-5 w-5 text-[#9ca3af] dark:text-slate-500" aria-hidden />
    </div>
  );
}

export function AwaitingReviewCard({ post, reviewHref }: AwaitingReviewCardProps) {
  const isGate1 = post.gate1_status === "pending";
  const concept = post.concept ?? "No concept provided.";
  const caption = post.caption ?? "No caption yet.";

  return (
    <div className="flex items-start gap-4 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-4">
      <PostThumbnail post={post} />

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              isGate1
                ? "bg-amber-500/10 text-amber-400"
                : "bg-[#CC2B2B]/15 text-[#CC2B2B]"
            )}
          >
            {isGate1 ? "GATE 1" : "GATE 2"}
          </span>
        </div>

        <p className="line-clamp-2 text-sm leading-snug text-[#111111] dark:text-white">{concept}</p>
        <p className="mt-1 line-clamp-1 text-xs text-[#6b7280] dark:text-slate-400">{caption}</p>
      </div>

      <Button
        asChild
        size="sm"
        className="shrink-0 bg-[#CC2B2B] text-white dark:bg-[#CC2B2B] hover:bg-[#6d28d9]"
      >
        <Link href={reviewHref}>Review</Link>
      </Button>
    </div>
  );
}
