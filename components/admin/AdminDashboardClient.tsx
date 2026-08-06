"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  DollarSign,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import type { SessionUser } from "@/lib/auth/user";
import type { Company } from "@/lib/supabase/types";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatIndustries } from "@/lib/validations/brand-config-normalize";

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "complete":
      return "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
    case "gate1_pending":
      return "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
    case "gate2_pending":
      return "bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800";
    case "failed":
      return "bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800";
    case "publishing":
      return "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800";
    default:
      return "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Completed";
    case "gate1_pending":
      return "Awaiting review";
    case "gate2_pending":
      return "Ready to publish";
    case "failed":
      return "Failed";
    case "publishing":
      return "Publishing";
    default:
      return status.replace(/_/g, " ");
  }
}

function getStepDotClass(status: string): string {
  if (status === "succeeded") {
    return "bg-emerald-500 dark:bg-emerald-400";
  }
  if (status === "failed") {
    return "bg-red-500 dark:bg-red-400";
  }
  if (status === "running") {
    return "bg-amber-500 dark:bg-amber-400 animate-pulse";
  }
  return "bg-slate-300 dark:bg-slate-600";
}

type CompanyRow = Company & {
  brand_configs?: { industry: string[] }[] | { industry: string[] } | null;
};

export type RecentRun = {
  id: string;
  status: string;
  week_start: string;
  created_at: string;
  companies: { name: string; slug: string } | null;
};

type BrandConfigSummary = {
  active_platforms: string[];
  zernio_account_ids: Record<string, unknown> | null;
};

export type HealthClient = {
  id: string;
  name: string;
  slug: string;
  status: string;
  brand_configs?: BrandConfigSummary | BrandConfigSummary[] | null;
  content_runs: {
    id: string;
    status: string;
    week_start: string;
    created_at: string;
  }[];
  posts: {
    id: string;
    pipeline_stage: string;
    gate1_status: string;
    gate2_status: string;
    published_at: string | null;
    created_at: string;
  }[];
};

export type BottleneckPost = {
  id: string;
  gate1_status: string;
  gate2_status: string;
  created_at: string;
  updated_at: string;
  companies: { name: string; slug: string } | null;
};

export type RecentActivityStep = {
  id: string;
  step_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  content_runs: {
    company_id: string;
    week_start: string;
    companies: { name: string; slug: string } | null;
  } | null;
};

function getBrandConfig(
  brandConfigs: HealthClient["brand_configs"]
): BrandConfigSummary | null {
  if (!brandConfigs) {
    return null;
  }

  return Array.isArray(brandConfigs) ? (brandConfigs[0] ?? null) : brandConfigs;
}

type AdminDashboardClientProps = {
  sessionUser: SessionUser;
  stats: {
    totalClients: number;
    postsThisWeek: number;
    activeCycles: number;
    monthlyCost: number;
  };
  companies: CompanyRow[];
  recentRuns: RecentRun[];
  healthData: HealthClient[];
  bottlenecks: BottleneckPost[];
  recentActivity: RecentActivityStep[];
  notificationCount?: number;
};

export function AdminDashboardClient({
  sessionUser,
  stats,
  companies,
  recentRuns,
  healthData,
  bottlenecks,
  recentActivity,
  notificationCount = 0,
}: AdminDashboardClientProps) {
  return (
    <AdminLayout
      title="Dashboard"
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Clients"
            value={stats.totalClients}
            icon={Users}
            variant="posts"
          />
          <StatCard
            label="Posts This Week"
            value={stats.postsThisWeek}
            icon={FileText}
            variant="posts"
          />
          <StatCard
            label="Active Cycles"
            value={stats.activeCycles}
            icon={RefreshCw}
            variant="pending"
          />
          <StatCard
            label="Monthly API Cost"
            value={`$${stats.monthlyCost.toFixed(2)}`}
            icon={DollarSign}
            variant="cost"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="surface-card xl:col-span-3">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="font-display font-semibold text-text-primary">
                Recent Clients
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-surface-hover text-left text-text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="px-5 py-3 font-medium">Industry</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-text-muted"
                      >
                        No clients yet. Add your first client to get started.
                      </td>
                    </tr>
                  ) : (
                    companies.map((company) => {
                      const industry = Array.isArray(company.brand_configs)
                        ? company.brand_configs[0]?.industry
                        : company.brand_configs?.industry;

                      return (
                        <tr
                          key={company.id}
                          className="border-t border-border-subtle hover:bg-bg-surface-hover"
                        >
                          <td className="px-5 py-3">
                            <Link
                              href={`/admin/clients/${company.slug}`}
                              className="font-medium text-accent-violet hover:text-accent-teal"
                            >
                              {company.name}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-text-muted">
                            {formatIndustries(industry, "N/A")}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge
                              status={company.status}
                              tone={
                                company.status.toLowerCase() === "paused"
                                  ? "neutral"
                                  : company.status.toLowerCase() === "cancelled"
                                    ? "danger"
                                    : "success"
                              }
                            />
                          </td>
                          <td className="px-5 py-3 text-text-muted">
                            {formatDisplayDate(company.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card xl:col-span-2">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="font-display font-semibold text-text-primary">
                Pipeline Activity
              </h2>
            </div>
            <div className="space-y-0 p-5">
              {recentRuns.length === 0 ? (
                <p className="text-sm text-text-muted">No pipeline activity yet.</p>
              ) : (
                recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-violet-400">
                        {run.companies?.name}
                      </span>
                      <span className="text-xs text-[#9ca3af] dark:text-slate-500">
                        Week of {format(new Date(run.week_start), "MMM d")}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBadgeClass(run.status)}`}
                    >
                      {getStatusLabel(run.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold text-text-primary">
              Client health
            </h2>
            <Link
              href="/admin/clients"
              className="text-xs text-[#9ca3af] dark:text-slate-500 transition-colors hover:text-violet-400"
            >
              View all clients
            </Link>
          </div>

          {healthData.length === 0 ? (
            <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-8 text-center text-sm text-[#9ca3af] dark:text-slate-500">
              No active clients yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {healthData.map((client) => {
                const runs = client.content_runs ?? [];
                const posts = client.posts ?? [];
                const lastRun = [...runs].sort(
                  (left, right) =>
                    new Date(right.created_at).getTime() -
                    new Date(left.created_at).getTime()
                )[0];
                const pendingApproval = posts.filter(
                  (post) =>
                    post.gate1_status === "pending" ||
                    post.gate2_status === "pending"
                ).length;
                const publishedThisMonth = posts.filter((post) => {
                  if (!post.published_at) {
                    return false;
                  }

                  const monthStart = new Date();
                  monthStart.setDate(1);
                  monthStart.setHours(0, 0, 0, 0);
                  return new Date(post.published_at) >= monthStart;
                }).length;
                const config = getBrandConfig(client.brand_configs);
                const connectedPlatforms = Object.keys(
                  (config?.zernio_account_ids as Record<string, unknown>) ?? {}
                ).length;
                const activePlatforms = config?.active_platforms?.length ?? 0;
                const hasIssue =
                  pendingApproval > 3 || connectedPlatforms === 0 || !lastRun;

                return (
                  <div
                    key={client.id}
                    className={`flex flex-col gap-3 rounded-xl border bg-white dark:bg-[#161616] p-4 ${
                      hasIssue
                        ? "border-amber-300 dark:border-amber-800/50"
                        : "border-[#E5E7EB] dark:border-[#2a2a2a]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/admin/clients/${client.slug}`}
                        className="text-sm font-medium text-[#111111] dark:text-white transition-colors hover:text-violet-400"
                      >
                        {client.name}
                      </Link>
                      {hasIssue ? (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Needs attention
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-[#f8fafc] dark:bg-[#0a0a0a] p-2 text-center">
                        <p className="text-lg font-medium text-[#111111] dark:text-white">
                          {publishedThisMonth}
                        </p>
                        <p className="text-xs text-[#9ca3af] dark:text-slate-500">Published</p>
                      </div>
                      <div
                        className={`rounded-lg bg-[#f8fafc] dark:bg-[#0a0a0a] p-2 text-center ${
                          pendingApproval > 3
                            ? "border border-amber-300 dark:border-amber-800"
                            : "border border-[#E5E7EB] dark:border-[#2a2a2a]"
                        }`}
                      >
                        <p
                          className={`text-lg font-medium ${
                            pendingApproval > 3
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[#111111] dark:text-white"
                          }`}
                        >
                          {pendingApproval}
                        </p>
                        <p className="text-xs text-[#9ca3af] dark:text-slate-500">Pending</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fafc] dark:bg-[#0a0a0a] p-2 text-center">
                        <p className="text-lg font-medium text-[#111111] dark:text-white">
                          {connectedPlatforms}/{activePlatforms}
                        </p>
                        <p className="text-xs text-[#9ca3af] dark:text-slate-500">Platforms</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#9ca3af] dark:text-slate-500">Last cycle</span>
                      <span
                        className={
                          lastRun
                            ? "text-[#6b7280] dark:text-slate-400"
                            : "text-xs font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {lastRun
                          ? format(new Date(lastRun.week_start), "MMM d")
                          : "No cycles yet"}
                      </span>
                    </div>

                    {lastRun ? (
                      <span
                        className={`w-fit text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBadgeClass(lastRun.status)}`}
                      >
                        {getStatusLabel(lastRun.status)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                Approval bottlenecks
              </span>
              <span className="text-xs text-[#9ca3af] dark:text-slate-500">Pending &gt; 24h</span>
            </div>

            {bottlenecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <CheckCircle size={24} className="text-emerald-500" />
                <p className="text-sm text-[#9ca3af] dark:text-slate-500">
                  No bottlenecks -- all caught up
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {bottlenecks.map((post) => {
                  const company = post.companies;
                  const gate =
                    post.gate2_status === "pending" ? "Gate 2" : "Gate 1";
                  const hoursWaiting = Math.round(
                    (Date.now() - new Date(post.updated_at).getTime()) / 3600000
                  );

                  return (
                    <div
                      key={post.id}
                      className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-2.5 last:border-0"
                    >
                      <div className="flex flex-col gap-0.5">
                        {company ? (
                          <Link
                            href={`/admin/clients/${company.slug}`}
                            className="text-sm text-[#111111] dark:text-white transition-colors hover:text-violet-400"
                          >
                            {company.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-[#111111] dark:text-white">Unknown client</span>
                        )}
                        <span
                          className={`text-xs font-medium ${
                            gate === "Gate 2"
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {gate} approval
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          hoursWaiting > 48
                            ? "bg-red-50 dark:bg-rose-900/40 text-red-700 dark:text-rose-400 border-red-200 dark:border-rose-800"
                            : "bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {hoursWaiting}h waiting
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-5">
            <span className="mb-4 block text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
              Recent activity
            </span>

            {recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#9ca3af] dark:text-slate-500">
                No recent pipeline activity.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {recentActivity.map((step) => {
                  const run = step.content_runs;
                  const company = run?.companies;
                  const stepLabel = step.step_name.replace(/_/g, " ");
                  const timeAgo = step.started_at
                    ? formatDistanceToNow(new Date(step.started_at), {
                        addSuffix: true,
                      })
                    : "Unknown time";

                  return (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-2.5 last:border-0"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${getStepDotClass(step.status)}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#374151] dark:text-slate-300">
                          {company ? (
                            <Link
                              href={`/admin/clients/${company.slug}`}
                              className="text-violet-400 hover:text-violet-300"
                            >
                              {company.name}
                            </Link>
                          ) : (
                            <span className="text-violet-400">Unknown client</span>
                          )}
                          {" -- "}
                          <span className="capitalize">{stepLabel}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">{timeAgo}</p>
                      </div>
                      {step.status === "failed" ? (
                        <span className="flex-shrink-0 text-xs text-red-700 dark:text-rose-400">
                          Failed
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

