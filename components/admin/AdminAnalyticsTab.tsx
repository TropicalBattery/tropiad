import { format } from "date-fns";
import {
  BarChart2,
  Eye,
  FileText,
  MousePointerClick,
} from "lucide-react";

import { DashboardStatCard } from "@/components/client/dashboard/DashboardStatCard";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Post } from "@/lib/supabase/types";

type PublishedPostAnalytics = Pick<
  Post,
  | "id"
  | "concept"
  | "platform"
  | "content_type"
  | "image_url"
  | "published_at"
  | "scheduled_at"
  | "impressions"
  | "reach"
  | "engagement"
  | "clicks"
  | "pipeline_stage"
>;

type AdminAnalyticsTabProps = {
  companyId: string;
};

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

export async function AdminAnalyticsTab({ companyId }: AdminAnalyticsTabProps) {
  const admin = createAdminClient();

  const { data: publishedPosts, error } = await admin
    .from("posts")
    .select(
      "id, concept, platform, content_type, image_url, published_at, scheduled_at, impressions, reach, engagement, clicks, pipeline_stage"
    )
    .eq("company_id", companyId)
    .eq("pipeline_stage", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm text-red-700 dark:text-rose-400">
        Failed to load analytics: {error.message}
      </div>
    );
  }

  const posts = (publishedPosts ?? []) as PublishedPostAnalytics[];

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

  const impressions = posts.map((post) => post.impressions);
  const engagements = posts.map((post) => post.engagement);
  const clicks = posts.map((post) => post.clicks);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Total published posts"
          value={posts.length}
          icon={FileText}
          accentClassName="border-l-[#CC2B2B]"
        />
        <DashboardStatCard
          label="Average engagement"
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
          label="Total clicks"
          value={sumOrDash(clicks)}
          icon={MousePointerClick}
          accentClassName="border-l-[#CC2B2B]"
        />
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
                <td className="py-3 pr-4 text-right text-xs text-[#6b7280] dark:text-slate-400">
                  {post.impressions?.toLocaleString() ?? "--"}
                </td>
                <td className="py-3 pr-4 text-right text-xs text-[#6b7280] dark:text-slate-400">
                  {post.reach?.toLocaleString() ?? "--"}
                </td>
                <td className="py-3 pr-4 text-right text-xs text-[#6b7280] dark:text-slate-400">
                  {post.engagement != null ? `${post.engagement}%` : "--"}
                </td>
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
          Engagement metrics are pulled from Zernio after posts go live. Data may
          take up to 24 hours to appear.
        </p>
      </div>
    </div>
  );
}
