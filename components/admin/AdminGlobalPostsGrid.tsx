"use client";

import { format } from "date-fns";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getContentTypeBadgeClass,
  getPipelineStageBadgeClass,
} from "@/lib/constants/theme-colors";
import type { Post } from "@/lib/supabase/types";

export type PostWithCompany = Post & {
  companies: { name: string; slug: string } | null;
};

type AdminGlobalPostsGridProps = {
  posts: PostWithCompany[];
};

type StatusFilter =
  | "all"
  | "pending_gate_1"
  | "pending_gate_2"
  | "producing"
  | "ready"
  | "published"
  | "failed"
  | "rejected";

type PlatformFilter =
  | "all"
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin";

function normalizePlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === "x") {
    return "twitter";
  }
  return normalized;
}

function matchesStatus(post: Post, status: StatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "pending_gate_1":
      return post.gate1_status === "pending";
    case "pending_gate_2":
      return post.gate2_status === "pending";
    case "producing":
      return post.pipeline_stage === "producing";
    case "ready":
      return post.pipeline_stage === "ready";
    case "published":
      return post.pipeline_stage === "published";
    case "failed":
      return post.pipeline_stage === "failed";
    case "rejected":
      return (
        post.gate1_status === "rejected" ||
        post.gate2_status === "rejected" ||
        post.pipeline_stage === "rejected"
      );
    default:
      return true;
  }
}

function matchesPlatform(post: Post, platform: PlatformFilter): boolean {
  if (platform === "all") {
    return true;
  }
  return normalizePlatform(post.platform) === platform;
}

export function AdminGlobalPostsGrid({ posts }: AdminGlobalPostsGridProps) {
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const companies = useMemo(() => {
    const names = new Map<string, string>();
    for (const post of posts) {
      if (post.companies?.name) {
        names.set(post.company_id, post.companies.name);
      }
    }
    return Array.from(names.entries()).sort(([, a], [, b]) => a.localeCompare(b));
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        if (companyFilter !== "all" && post.company_id !== companyFilter) {
          return false;
        }
        return (
          matchesStatus(post, statusFilter) &&
          matchesPlatform(post, platformFilter)
        );
      }),
    [posts, companyFilter, statusFilter, platformFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[200px] border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] text-[#374151] dark:text-slate-300">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map(([companyId, name]) => (
              <SelectItem key={companyId} value={companyId}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-[180px] border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] text-[#374151] dark:text-slate-300">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending_gate_1">Pending Gate 1</SelectItem>
            <SelectItem value="pending_gate_2">Pending Gate 2</SelectItem>
            <SelectItem value="producing">Producing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}
        >
          <SelectTrigger className="w-[160px] border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] text-[#374151] dark:text-slate-300">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="twitter">Twitter</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-10 text-center text-sm text-[#9ca3af] dark:text-slate-500">
          No posts match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616]"
            >
              {post.image_url ? (
                <Image
                  src={post.image_url}
                  alt=""
                  width={400}
                  height={400}
                  className="h-40 w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-[#f8fafc] dark:bg-[#1a1a2e]">
                  <ImageIcon size={28} className="text-slate-600" />
                </div>
              )}
              <div className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap gap-2">
                  {post.companies?.name ? (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-sky-50 dark:bg-cyan-900/40 text-sky-700 dark:text-cyan-300 border border-sky-200 dark:border-cyan-800">
                      {post.companies.name}
                    </span>
                  ) : null}
                  <PlatformBadge platform={post.platform} />
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs uppercase ${getContentTypeBadgeClass(post.content_type)}`}
                  >
                    {post.content_type}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-[#374151] dark:text-slate-300">
                  {post.concept}
                </p>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getPipelineStageBadgeClass(post.pipeline_stage)}`}
                  >
                    {post.pipeline_stage}
                  </span>
                  <span className="text-xs text-slate-600">
                    {post.scheduled_at
                      ? format(new Date(post.scheduled_at), "MMM d")
                      : "Unscheduled"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
