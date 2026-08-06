import Link from "next/link";
import { Film, Sparkles } from "lucide-react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import type { Post } from "@/lib/supabase/types";
import { formatDisplayDate } from "@/lib/utils/format-date";

type RecentPostCardProps = {
  post: Post;
  postsHref: string;
};

function PostThumbnail({ post }: { post: Post }) {
  if (post.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.image_url}
        alt=""
        className="h-20 w-full rounded-lg object-cover"
      />
    );
  }

  if (post.video_url) {
    return (
      <div className="flex h-20 w-full items-center justify-center rounded-lg bg-[#f8fafc] dark:bg-[#1f1f1f]">
        <Film className="h-6 w-6 text-[#06b6d4]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-full items-center justify-center rounded-lg bg-[#f8fafc] dark:bg-[#1f1f1f]">
      <Sparkles className="h-6 w-6 text-[#9ca3af] dark:text-slate-500" aria-hidden />
    </div>
  );
}

export function RecentPostCard({ post, postsHref }: RecentPostCardProps) {
  const publishedLabel = post.published_at
    ? formatDisplayDate(post.published_at)
    : "Recently published";

  return (
    <Link
      href={postsHref}
      className="group block rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-3 transition-colors hover:border-violet-500/40"
    >
      <PostThumbnail post={post} />

      <div className="mt-3 space-y-2">
        <PlatformBadge platform={post.platform} />
        <p className="text-xs text-[#6b7280] dark:text-slate-400">{publishedLabel}</p>
        {post.engagement != null ? (
          <p className="text-sm font-medium text-emerald-400">
            {Math.round(post.engagement)}% engagement
          </p>
        ) : null}
      </div>
    </Link>
  );
}
