"use client";

import { format } from "date-fns";
import {
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { AwaitingReviewCard } from "@/components/client/dashboard/AwaitingReviewCard";
import {
  DashboardPipelineWidget,
  QuickActionsWidget,
} from "@/components/client/dashboard/DashboardPipelineWidget";
import { ContentMixChart } from "@/components/client/dashboard/ContentMixChart";
import { DashboardStatCard } from "@/components/client/dashboard/DashboardStatCard";
import { PromotionsWidget } from "@/components/client/dashboard/PromotionsWidget";
import { ReadyForApprovalPreviewCard } from "@/components/shared/ReadyForApprovalPreviewCard";
import type { Company, ContentRun, Post, Promotion, RunStep } from "@/lib/supabase/types";
import type { ContentMixPercentages } from "@/lib/utils/client-dashboard";
import {
  isAwaitingReview,
  isGate2PendingApproval,
  isPublishedThisMonth,
  isReadyToPublish,
  isScheduledThisWeek,
} from "@/lib/utils/client-dashboard";

export type ScheduledPostPreview = Pick<
  Post,
  | "id"
  | "concept"
  | "caption"
  | "platform"
  | "content_type"
  | "scheduled_at"
  | "image_url"
  | "pipeline_stage"
>;

type ClientDashboardViewProps = {
  slug: string;
  company: Company;
  posts: Post[];
  contentRun: ContentRun | null;
  runSteps: RunStep[];
  contentMix: ContentMixPercentages;
  promotions?: Promotion[] | null;
  activePlatforms: string[];
  scheduledPosts: ScheduledPostPreview[];
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function ClientDashboardView({
  slug,
  company,
  posts,
  contentRun,
  runSteps,
  contentMix,
  promotions,
  activePlatforms,
  scheduledPosts,
}: ClientDashboardViewProps) {
  const approveHref = `/dashboard/${slug}/approve`;
  const approvePostsHref = `/dashboard/${slug}/approve?tab=posts`;

  const awaitingReview = useMemo(
    () => posts.filter(isAwaitingReview),
    [posts]
  );

  const gate2ForApproval = useMemo(
    () => posts.filter(isGate2PendingApproval).slice(0, 4),
    [posts]
  );

  const stats = useMemo(() => {
    const readyToPublish = posts.filter(isReadyToPublish).length;
    const scheduledThisWeek = posts.filter((post) =>
      isScheduledThisWeek(post.scheduled_at)
    ).length;
    const publishedThisMonth = posts.filter((post) =>
      isPublishedThisMonth(post.published_at)
    ).length;

    const publishedWithEngagement = posts.filter(
      (post) =>
        isPublishedThisMonth(post.published_at) && post.engagement != null
    );

    const avgEngagement =
      publishedWithEngagement.length > 0
        ? Math.round(
            publishedWithEngagement.reduce(
              (sum, post) => sum + (post.engagement ?? 0),
              0
            ) / publishedWithEngagement.length
          )
        : null;

    return {
      readyToPublish,
      scheduledThisWeek,
      publishedThisMonth,
      avgEngagement,
    };
  }, [posts]);

  return (
    <div className="-mx-4 min-h-full bg-[#F3F4F6] px-4 py-2 dark:bg-[#0a0a0a] lg:-mx-8 lg:px-8">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#111111] dark:text-white">
            {getGreeting()}, {company.name}
          </h2>
          <p className="mt-1 text-[#6B7280] dark:text-slate-400">
            Your AI content command center for this week.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Ready to Publish"
            value={stats.readyToPublish}
            icon={Sparkles}
            variant="pending"
          />
          <DashboardStatCard
            label="Scheduled This Week"
            value={stats.scheduledThisWeek}
            icon={Calendar}
            variant="posts"
          />
          <DashboardStatCard
            label="Published This Month"
            value={stats.publishedThisMonth}
            icon={Send}
            variant="published"
          />
          <DashboardStatCard
            label="Avg Engagement"
            value={
              stats.avgEngagement != null ? `${stats.avgEngagement}%` : "--"
            }
            icon={BarChart2}
            variant="cost"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                Awaiting Your Review
              </h3>

              {awaitingReview.length > 0 ? (
                <div className="space-y-3">
                  {awaitingReview.slice(0, 3).map((post) => (
                    <AwaitingReviewCard
                      key={post.id}
                      post={post}
                      reviewHref={approveHref}
                    />
                  ))}

                  {awaitingReview.length > 3 ? (
                    <div className="pt-1 text-center">
                      <Link
                        href={approveHref}
                        className="text-sm font-medium text-[#CC2B2B] hover:text-[#CC2B2B]"
                      >
                        View all ({awaitingReview.length})
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden />
                  </div>
                  <p className="text-sm text-[#6b7280] dark:text-slate-400">
                    All caught up! No posts awaiting review.
                  </p>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                Gate 2 Approval
              </h3>

              {gate2ForApproval.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {gate2ForApproval.map((post) => (
                    <ReadyForApprovalPreviewCard
                      key={post.id}
                      post={post}
                      companyName={company.name}
                      reviewHref={approvePostsHref}
                    />
                  ))}
                </div>
              ) : scheduledPosts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="mb-1 text-xs text-[#9ca3af] dark:text-slate-500">
                    Nothing pending -- here is what is coming up:
                  </p>
                  {scheduledPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-4 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-4"
                    >
                      {post.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.image_url}
                          alt=""
                          className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-[#f8fafc] dark:bg-[#1f1f1f]">
                          <ImageIcon
                            size={20}
                            className="text-slate-600"
                            aria-hidden
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <PlatformBadge platform={post.platform} />
                          <span className="text-xs font-medium text-emerald-400">
                            Scheduled
                          </span>
                        </div>
                        <p className="line-clamp-1 text-sm text-[#374151] dark:text-slate-300">
                          {post.caption ?? post.concept}
                        </p>
                        {post.scheduled_at ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-[#9ca3af] dark:text-slate-500">
                            <Clock size={11} aria-hidden />
                            {format(
                              new Date(post.scheduled_at),
                              "MMM d, yyyy h:mm a"
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
                  <p className="text-sm text-[#6b7280] dark:text-slate-400">
                    No posts awaiting Gate 2 approval.
                  </p>
                </div>
              )}
            </section>

            <PromotionsWidget
              companyId={company.id}
              initialPromotions={promotions ?? []}
              activePlatforms={activePlatforms}
            />
          </div>

          <div className="space-y-6 xl:col-span-2">
            <DashboardPipelineWidget
              slug={slug}
              contentRun={contentRun}
              runSteps={runSteps}
              posts={posts}
            />
            <ContentMixChart mix={contentMix} />
            <QuickActionsWidget slug={slug} />
          </div>
        </div>
      </div>
    </div>
  );
}
