"use client";

import {
  BarChart2,
  DollarSign,
  FileText,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AwaitingConnectionBanner } from "@/components/admin/AwaitingConnectionBanner";
import { RecurringFeedbackBanner } from "@/components/admin/RecurringFeedbackBanner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BrandConfigPanel } from "@/components/admin/BrandConfigPanel";
import { PipelineRunsSection } from "@/components/admin/PipelineRunsSection";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SessionUser } from "@/lib/auth/user";
import type { RecurringFeedbackAlert } from "@/lib/agents/rejection-feedback";
import type {
  BrandConfig,
  Company,
  ContentRun,
  Cycle,
  Post,
  RunStep,
} from "@/lib/supabase/types";
import { formatIndustries } from "@/lib/validations/brand-config-normalize";
import { useRunNowPipeline } from "@/lib/hooks/use-run-now-pipeline";

type AdminClientDetailViewProps = {
  sessionUser: SessionUser;
  company: Company | null;
  brand: BrandConfig | null;
  posts: Post[];
  avgEngagement: string;
  currentCycle: Cycle | null;
  contentRuns: ContentRun[];
  stepsByRunId: Record<string, RunStep[]>;
  monthlyCostUsd: number;
  awaitingConnectionPosts: Array<Pick<Post, "id" | "platform">>;
  connectedStatus: string | null;
  recurringFeedbackAlerts: RecurringFeedbackAlert[];
  notificationCount?: number;
  postsTab: ReactNode;
  cyclesTab: ReactNode;
  analyticsTab: ReactNode;
};

export function AdminClientDetailView({
  sessionUser,
  company,
  brand,
  posts,
  avgEngagement,
  currentCycle,
  contentRuns,
  stepsByRunId,
  monthlyCostUsd,
  awaitingConnectionPosts,
  connectedStatus,
  recurringFeedbackAlerts,
  notificationCount = 0,
  postsTab,
  cyclesTab,
  analyticsTab,
}: AdminClientDetailViewProps) {
  useEffect(() => {
    if (connectedStatus === "success") {
      toast.success("Social account connected successfully.");
    } else if (connectedStatus === "error") {
      toast.error("Social account connection failed. Try again.");
    }
  }, [connectedStatus]);

  const awaitingSummary = useMemo(() => {
    const platforms = Array.from(
      new Set(awaitingConnectionPosts.map((post) => post.platform))
    );
    return {
      count: awaitingConnectionPosts.length,
      platforms,
    };
  }, [awaitingConnectionPosts]);
  const publishedThisWeek = posts.filter(
    (post) => post.pipeline_stage === "published"
  ).length;
  const pendingApproval = posts.filter(
    (post) =>
      post.gate1_status === "pending" || post.gate2_status === "pending"
  ).length;
  const { running: triggeringCycle, runNow: triggerCycle } = useRunNowPipeline(
    company?.slug ?? ""
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [generatingReport, setGeneratingReport] = useState(false);

  async function handleSendReport() {
    if (!company) {
      return;
    }

    setGeneratingReport(true);

    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to send report");
      }

      toast.success("Monthly report sent successfully");
    } catch (err) {
      toast.error("Failed to send report. Please try again.");
      console.error("[report]", err);
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <AdminLayout
      title={company?.name ?? "Client"}
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      {!company ? (
        <div className="surface-card p-10 text-center">
          <p className="text-text-muted">Client not found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="surface-card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-semibold text-text-primary">
                  {company.name}
                </h2>
                <Badge variant="secondary">{company.slug}</Badge>
                <StatusBadge status={company.status} tone="success" />
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {formatIndustries(brand?.industry, "Industry not set")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={triggeringCycle}
                onClick={() => void triggerCycle()}
              >
                {triggeringCycle ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Trigger Cycle
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("brand")}>
                Edit Config
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="posts">
                <FileText className="mr-2 h-4 w-4" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="cycles">
                <RefreshCw className="mr-2 h-4 w-4" />
                Cycles
              </TabsTrigger>
              <TabsTrigger value="brand">
                <Settings className="mr-2 h-4 w-4" />
                Brand Config
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart2 className="mr-2 h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {company ? (
                <AwaitingConnectionBanner
                  companyId={company.id}
                  companyName={company.name}
                  summary={awaitingSummary}
                />
              ) : null}

              <RecurringFeedbackBanner alerts={recurringFeedbackAlerts} />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  label="Total Posts"
                  value={posts.length}
                  icon={FileText}
                />
                <StatCard
                  label="Published This Week"
                  value={publishedThisWeek}
                  icon={RefreshCw}
                />
                <StatCard
                  label="Pending Approval"
                  value={pendingApproval}
                  icon={LayoutDashboard}
                  iconClassName="text-amber-500"
                  iconBgClassName="bg-amber-500/10"
                />
                <StatCard
                  label="This Month's Cost"
                  value={`$${monthlyCostUsd.toFixed(2)}`}
                  icon={DollarSign}
                  iconClassName="text-tbc-red"
                  iconBgClassName="bg-[rgba(124,92,255,0.12)]"
                />
                <StatCard
                  label="Engagement Rate"
                  value={avgEngagement}
                  icon={BarChart2}
                  iconClassName="text-blue-600"
                  iconBgClassName="bg-blue-600/10"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSendReport()}
                disabled={generatingReport}
                className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] dark:border-[#2a2a2a] px-4 py-2 text-sm text-[#6b7280] dark:text-slate-400 transition-colors hover:border-violet-500/40 hover:text-[#111111] dark:text-white disabled:opacity-50"
              >
                <FileText size={14} />
                {generatingReport ? "Generating..." : "Send monthly report"}
              </button>

              <PipelineRunsSection
                companySlug={company.slug}
                runs={contentRuns}
                stepsByRunId={stepsByRunId}
              />

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="surface-card lg:col-span-2">
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="font-semibold text-text-primary">
                      Recent Posts
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f8fafc] dark:bg-[#0a0a0a] text-left text-text-muted">
                        <tr>
                          <th className="px-5 py-3">Platform</th>
                          <th className="px-5 py-3">Stage</th>
                          <th className="px-5 py-3">Gate 1</th>
                          <th className="px-5 py-3">Gate 2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-5 py-8 text-center text-text-muted"
                            >
                              No posts yet.
                            </td>
                          </tr>
                        ) : (
                          posts.map((post) => (
                            <tr key={post.id} className="border-t border-border">
                              <td className="px-5 py-3">{post.platform}</td>
                              <td className="px-5 py-3 capitalize">
                                <StatusBadge status={post.pipeline_stage} />
                              </td>
                              <td className="px-5 py-3 capitalize">
                                <StatusBadge status={post.gate1_status} />
                              </td>
                              <td className="px-5 py-3 capitalize">
                                <StatusBadge status={post.gate2_status} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="surface-card p-5">
                  <h3 className="font-semibold text-text-primary">
                    Current Cycle
                  </h3>
                  {currentCycle ? (
                    <div className="mt-4 space-y-2 text-sm">
                      <p>
                        <span className="text-text-muted">Status:</span>{" "}
                        <span className="capitalize">{currentCycle.status}</span>
                      </p>
                      <p>
                        <span className="text-text-muted">Concepts:</span>{" "}
                        {currentCycle.concepts_generated}
                      </p>
                      <p>
                        <span className="text-text-muted">Approved:</span>{" "}
                        {currentCycle.concepts_approved}
                      </p>
                      <p>
                        <span className="text-text-muted">Published:</span>{" "}
                        {currentCycle.posts_published}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-text-muted">
                      No active cycle this week.
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="posts">{postsTab}</TabsContent>

            <TabsContent value="cycles">{cyclesTab}</TabsContent>

            <TabsContent value="brand" className="rounded-xl bg-[#f8fafc] dark:bg-[#0a0a0a]">
              {brand && company ? (
                <BrandConfigPanel
                  companyId={company.id}
                  companySlug={company.slug}
                  ownerEmail={company.owner_email}
                  initialBrand={brand}
                />
              ) : (
                <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm italic text-slate-600">
                  Brand config not found.
                </div>
              )}
            </TabsContent>

            <TabsContent value="analytics">{analyticsTab}</TabsContent>
          </Tabs>
        </div>
      )}
    </AdminLayout>
  );
}
