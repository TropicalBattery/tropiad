import { redirect } from "next/navigation";

import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminClientDetailView } from "@/components/admin/AdminClientDetailView";
import { AdminCyclesTab } from "@/components/admin/AdminCyclesTab";
import type { ContentRunWithSteps } from "@/components/admin/AdminCyclesTab";
import { AdminPostsTab } from "@/components/admin/AdminPostsTab";
import { getSessionUser } from "@/lib/auth/session";
import { getRecurringFeedbackAlerts } from "@/lib/agents/rejection-feedback";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWeekStartIso } from "@/lib/utils/dashboard";
import type { Post, RunStep } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug: string };
  searchParams?: { connected?: string };
};

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: PageProps) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const notificationCount = await getAdminBottleneckCount();
  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!company) {
    return (
      <AdminClientDetailView
        sessionUser={sessionUser}
        company={null}
        brand={null}
        posts={[]}
        avgEngagement="--"
        currentCycle={null}
        contentRuns={[]}
        stepsByRunId={{}}
        monthlyCostUsd={0}
        awaitingConnectionPosts={[]}
        connectedStatus={null}
        recurringFeedbackAlerts={[]}
        notificationCount={notificationCount}
        postsTab={null}
        cyclesTab={null}
        analyticsTab={null}
      />
    );
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    brandResult,
    postsResult,
    currentCycleResult,
    contentRunsWithStepsResult,
    contentRunsResult,
    monthlyCostResult,
    awaitingPostsResult,
  ] = await Promise.all([
      admin
        .from("brand_configs")
        .select("*")
        .eq("company_id", company.id)
        .maybeSingle(),
      admin
        .from("posts")
        .select(
          "id, platform, pipeline_stage, gate1_status, gate2_status, published_at, engagement, created_at"
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false }),
      admin
        .from("cycles")
        .select("*")
        .eq("company_id", company.id)
        .eq("week_start", getWeekStartIso())
        .maybeSingle(),
      admin
        .from("content_runs")
        .select(
          `
          *,
          run_steps (*)
        `
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("content_runs")
        .select("*")
        .eq("company_id", company.id)
        .order("week_start", { ascending: false })
        .limit(5),
      admin
        .from("cost_events")
        .select("estimated_cost_usd")
        .eq("company_id", company.id)
        .gte("created_at", monthStart.toISOString()),
      admin
        .from("posts")
        .select("id, platform")
        .eq("company_id", company.id)
        .eq("pipeline_stage", "awaiting_connection"),
    ]);

  const contentRuns = contentRunsResult.data ?? [];
  const runIds = contentRuns.map((run) => run.id);

  let stepsByRunId: Record<string, RunStep[]> = {};
  if (runIds.length > 0) {
    const { data: runSteps } = await admin
      .from("run_steps")
      .select("*")
      .in("run_id", runIds);

    stepsByRunId = (runSteps ?? []).reduce<Record<string, RunStep[]>>(
      (accumulator, step) => {
        const existing = accumulator[step.run_id] ?? [];
        existing.push(step);
        accumulator[step.run_id] = existing;
        return accumulator;
      },
      {}
    );
  }

  const monthlyCostUsd = (monthlyCostResult.data ?? []).reduce(
    (total, event) => total + Number(event.estimated_cost_usd ?? 0),
    0
  );

  const recurringFeedbackAlerts = await getRecurringFeedbackAlerts(company.id);

  const overviewPosts = postsResult.data ?? [];
  const publishedWithEngagement = overviewPosts.filter(
    (post) => post.pipeline_stage === "published" && post.engagement != null
  );
  const avgEngagement =
    publishedWithEngagement.length > 0
      ? (
          publishedWithEngagement.reduce(
            (sum, post) => sum + (post.engagement ?? 0),
            0
          ) / publishedWithEngagement.length
        ).toFixed(1) + "%"
      : "--";

  return (
    <AdminClientDetailView
      sessionUser={sessionUser}
      company={company}
      brand={brandResult.data}
      posts={overviewPosts as Post[]}
      avgEngagement={avgEngagement}
      currentCycle={currentCycleResult.data}
      contentRuns={contentRuns}
      stepsByRunId={stepsByRunId}
      monthlyCostUsd={monthlyCostUsd}
      awaitingConnectionPosts={(awaitingPostsResult.data ?? []) as Pick<
        Post,
        "id" | "platform"
      >[]}
      connectedStatus={searchParams?.connected ?? null}
      recurringFeedbackAlerts={recurringFeedbackAlerts}
      notificationCount={notificationCount}
      postsTab={<AdminPostsTab companyId={company.id} />}
      cyclesTab={
        <AdminCyclesTab
          contentRuns={(contentRunsWithStepsResult.data ?? []) as ContentRunWithSteps[]}
        />
      }
      analyticsTab={<AdminAnalyticsTab companyId={company.id} />}
    />
  );
}
