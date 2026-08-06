import { format } from "date-fns";
import {
  BarChart2,
  Eye,
  FileText,
  TrendingUp,
} from "lucide-react";

import { DashboardStatCard } from "@/components/client/dashboard/DashboardStatCard";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import type { Post } from "@/lib/supabase/types";

type PublishedPostAnalytics = Pick<
  Post,
  | "id"
  | "concept"
  | "platform"
  | "content_type"
  | "image_url"
  | "published_at"
  | "impressions"
  | "reach"
  | "engagement"
  | "clicks"
  | "content_category"
>;

type ClientAnalyticsViewProps = {
  posts: PublishedPostAnalytics[];
};

const CONTENT_CATEGORIES = ["educational", "promotional", "engagement"] as const;

function sumOrDash(values: Array<number | null>): string {
  const numbers = values.filter((value): value is number => value != null);
  if (numbers.length === 0) {
    return "--";
  }
  return numbers.reduce((total, value) => total + value, 0).toLocaleString();
}

function averageEngagementOrDash(values: Array<number | null>): string {
  const numbers = values.filter((value): value is number => value != null);
  if (numbers.length === 0) {
    return "--";
  }

  const average =
    numbers.reduce((total, value) => total + value, 0) / numbers.length;
  return `${average.toFixed(1)}%`;
}

function bestPerformingConcept(posts: PublishedPostAnalytics[]): string {
  const withEngagement = posts.filter((post) => post.engagement != null);
  if (withEngagement.length === 0) {
    return "--";
  }

  const best = withEngagement.reduce((top, post) =>
    (post.engagement ?? 0) > (top.engagement ?? 0) ? post : top
  );
  const concept = best.concept ?? "";
  if (!concept) {
    return "--";
  }
  return concept.length > 30 ? `${concept.slice(0, 30)}...` : concept;
}

function hasAnalytics(post: PublishedPostAnalytics): boolean {
  return (
    post.impressions != null ||
    post.reach != null ||
    post.engagement != null ||
    post.clicks != null
  );
}

export function ClientAnalyticsView({ posts }: ClientAnalyticsViewProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-12 text-center">
        <BarChart2 className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-4 text-sm text-[#6b7280] dark:text-slate-400">
          No published posts yet. Analytics will appear here once content goes
          live.
        </p>
      </div>
    );
  }

  const total = posts.length;
  const impressions = posts.map((post) => post.impressions);
  const engagements = posts.map((post) => post.engagement);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Total published posts"
          value={total}
          icon={FileText}
          accentClassName="border-l-[#CC2B2B]"
        />
        <DashboardStatCard
          label="Avg engagement"
          value={averageEngagementOrDash(engagements)}
          icon={BarChart2}
          accentClassName="border-l-[#06b6d4]"
        />
        <DashboardStatCard
          label="Total impressions"
          value={sumOrDash(impressions)}
          icon={Eye}
          accentClassName="border-l-emerald-400"
        />
        <DashboardStatCard
          label="Best performing post"
          value={bestPerformingConcept(posts)}
          icon={TrendingUp}
          accentClassName="border-l-[#CC2B2B]"
        />
      </div>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
          Content Mix
        </h3>
        {CONTENT_CATEGORIES.map((category) => {
          const count =
            posts.filter((post) => post.content_category === category).length ??
            0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={category} className="mb-3 flex items-center gap-3">
              <span className="w-24 text-xs capitalize text-[#6b7280] dark:text-slate-400">
                {category}
              </span>
              <div className="h-2 flex-1 rounded-full bg-[#f8fafc] dark:bg-[#1f1f1f]">
                <div
                  className={`h-2 rounded-full ${
                    category === "educational"
                      ? "bg-violet-500"
                      : category === "promotional"
                        ? "bg-cyan-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-[#6b7280] dark:text-slate-400">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] dark:border-[#2a2a2a] text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
              <th className="py-2 pr-4 text-left">Post</th>
              <th className="py-2 pr-4 text-left">Platform</th>
              <th className="py-2 pr-4 text-right">Impressions</th>
              <th className="py-2 pr-4 text-right">Reach</th>
              <th className="py-2 pr-4 text-right">Engagement</th>
              <th className="py-2 text-right">Published</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-b border-[#E5E7EB] dark:border-[#2a2a2a] transition-colors hover:bg-[#f8fafc] dark:hover:bg-[#0f0f1a]"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    {post.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.image_url}
                        alt=""
                        className="h-10 w-10 flex-shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <span className="line-clamp-1 text-xs text-[#374151] dark:text-slate-300">
                      {post.concept?.slice(0, 60)}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <PlatformBadge platform={post.platform} />
                </td>
                {hasAnalytics(post) ? (
                  <>
                    <td className="py-3 pr-4 text-right text-xs text-[#6b7280] dark:text-slate-400">
                      {post.impressions?.toLocaleString() ?? "--"}
                    </td>
                    <td className="py-3 pr-4 text-right text-xs text-[#6b7280] dark:text-slate-400">
                      {post.reach?.toLocaleString() ?? "--"}
                    </td>
                    <td className="py-3 pr-4 text-right text-xs text-[#6b7280] dark:text-slate-400">
                      {post.engagement != null ? `${post.engagement}%` : "--"}
                    </td>
                  </>
                ) : (
                  <td
                    colSpan={3}
                    className="py-3 pr-4 text-right text-xs italic text-slate-600"
                  >
                    Awaiting analytics
                  </td>
                )}
                <td className="py-3 text-right text-xs text-[#9ca3af] dark:text-slate-500">
                  {post.published_at
                    ? format(new Date(post.published_at), "MMM d")
                    : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-xs italic text-slate-600">
          Analytics are updated automatically after your posts go live. Data may
          take up to 24 hours to appear.
        </p>
      </div>
    </div>
  );
}
