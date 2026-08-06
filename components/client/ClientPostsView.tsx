"use client";

import {
  Eye,
  Heart,
  MousePointer,
  Play,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Company, Post } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { formatScheduledAt } from "@/lib/utils/dashboard";

export type ClientPostsViewPost = Pick<
  Post,
  | "id"
  | "concept"
  | "caption"
  | "platform"
  | "content_type"
  | "image_url"
  | "video_url"
  | "scheduled_at"
  | "published_at"
  | "pipeline_stage"
  | "impressions"
  | "reach"
  | "engagement"
  | "clicks"
  | "analytics_pulled_at"
  | "gate1_status"
  | "gate2_status"
>;

type ClientPostsViewProps = {
  company: Company;
  posts: ClientPostsViewPost[];
};

export function ClientPostsView({
  company,
  posts: initialPosts,
}: ClientPostsViewProps) {
  const [posts] = useState<ClientPostsViewPost[]>(initialPosts);
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("published");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientPostsViewPost | null>(null);

  const filtered = posts.filter((post) => {
    if (platform !== "all" && post.platform !== platform) return false;

    if (status === "published" && post.pipeline_stage !== "published") {
      return false;
    }

    if (
      status === "scheduled" &&
      (!post.scheduled_at || post.pipeline_stage === "published")
    ) {
      return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      post.caption?.toLowerCase().includes(query) ||
      post.concept?.toLowerCase().includes(query)
    );
  });

  const timezone = "America/Jamaica";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-text-primary">
            Published posts
          </h2>
          <p className="text-sm text-text-muted">
            What&apos;s gone live on your Instagram
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="LinkedIn">LinkedIn</SelectItem>
              <SelectItem value="X">X</SelectItem>
              <SelectItem value="Facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(124,92,255,0.12)]">
            <Send className="h-7 w-7 text-accent-violet" />
          </div>
          <h3 className="font-display text-lg font-semibold text-text-primary">
            No published posts yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
            Approved posts will appear here once they&apos;re live on
            Instagram.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelected(post)}
              className={cn(
                "surface-card text-left transition hover:border-border-glow",
                selected?.id === post.id
                  ? "bg-[#eff6ff] dark:bg-[#1f1f1f]"
                  : "hover:bg-[#f8fafc] dark:hover:bg-[#0f0f1a]"
              )}
            >
              <div className="flex h-40 items-center justify-center overflow-hidden rounded-t-2xl bg-bg-surface-hover">
                {post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : post.video_url ? (
                  <Play className="h-10 w-10 text-text-muted" />
                ) : (
                  <span className="text-sm text-text-muted">No media</span>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <PlatformBadge platform={post.platform} />
                  <StatusBadge status={post.pipeline_stage} />
                </div>
                <p className="line-clamp-2 text-sm text-text-primary">
                  {post.caption ?? post.concept ?? "No content yet"}
                </p>
                <div className="mt-2 flex items-center gap-4">
                  {post.impressions != null ? (
                    <>
                      <span className="flex items-center gap-1 text-xs text-[#9ca3af] dark:text-slate-500">
                        <Eye size={11} />
                        {post.impressions.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#9ca3af] dark:text-slate-500">
                        <Users size={11} />
                        {post.reach?.toLocaleString() ?? "--"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#9ca3af] dark:text-slate-500">
                        <Heart size={11} />
                        {post.engagement ? `${post.engagement}%` : "--"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#9ca3af] dark:text-slate-500">
                        <MousePointer size={11} />
                        {post.clicks?.toLocaleString() ?? "--"}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs italic text-slate-600">
                      Awaiting analytics
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  {formatScheduledAt(
                    post.published_at ?? post.scheduled_at,
                    timezone
                  )}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelected(null)}
            aria-label="Close panel overlay"
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-border-subtle bg-bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <PlatformBadge platform={selected.platform} />
                <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">
                  Post Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-text-muted hover:bg-bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <Detail label="Content type" value={selected.content_type} badge />
              <Detail label="Gate 1" value={selected.gate1_status} badge />
              <Detail label="Gate 2" value={selected.gate2_status} badge />
              <Detail label="Pipeline" value={selected.pipeline_stage} badge />
              <Detail
                label="Scheduled"
                value={formatScheduledAt(selected.scheduled_at, timezone)}
              />
              <div>
                <p className="mb-1 text-text-muted">Caption</p>
                <p className="whitespace-pre-wrap text-text-primary">
                  {selected.caption ?? selected.concept ?? "No caption"}
                </p>
              </div>
              {company && (
                <p className="text-xs text-text-muted">
                  Client: {company.name}
                </p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  badge = false,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="capitalize">
      <p className="text-text-muted">{label}</p>
      {badge ? (
        <StatusBadge status={value} className="mt-1" />
      ) : (
        <p className="font-medium text-text-primary">{value}</p>
      )}
    </div>
  );
}
