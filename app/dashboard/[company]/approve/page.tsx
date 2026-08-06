import { Suspense } from "react";

import { ApprovalDashboard } from "@/components/dashboard/ApprovalDashboard";
import { ClientLayout } from "@/components/layout/ClientLayout";
import {
  buildApprovalCycleOptions,
  isValidRunIdParam,
  resolveApprovalTab,
  resolveRunSelection,
  type ApprovalQueueTab,
} from "@/lib/approvals/approval-cycles";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";
import { getWeekStartIso } from "@/lib/utils/dashboard";

type PageProps = {
  params: { company: string };
  searchParams: { tab?: string; run?: string };
};

function resolveInitialTab(
  tab: string | undefined
): ApprovalQueueTab {
  return resolveApprovalTab(tab);
}

export default async function ClientApprovePage({
  params,
  searchParams,
}: PageProps) {
  const { sessionUser, company, pendingApprovalCount } =
    await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const [postsResult, cycleResult, brandResult] = await Promise.all([
    admin
      .from("posts")
      .select("*")
      .eq("company_id", company.id)
      .not("pipeline_stage", "in", "(published,rejected)")
      .or(
        "gate1_status.eq.pending,gate2_status.eq.pending,gate2_status.eq.edit_requested,and(gate1_status.eq.approved,pipeline_stage.in.(ideation,visual,producing,failed,awaiting_connection,copywriting,ready))"
      )
      .order("created_at", { ascending: true }),
    admin
      .from("cycles")
      .select("*")
      .eq("company_id", company.id)
      .eq("week_start", getWeekStartIso())
      .maybeSingle(),
    admin
      .from("brand_configs")
      .select("*")
      .eq("company_id", company.id)
      .maybeSingle(),
  ]);

  const pendingPosts = postsResult.data ?? [];
  const runIds = Array.from(
    new Set(
      pendingPosts
        .map((post) => post.run_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const contentRunsResult =
    runIds.length > 0
      ? await admin
          .from("content_runs")
          .select("id, week_start, status")
          .eq("company_id", company.id)
          .in("id", runIds)
          .order("week_start", { ascending: false })
      : { data: [] as { id: string; week_start: string; status: string }[] };

  const contentRuns = contentRunsResult.data ?? [];
  const cycleOptions = buildApprovalCycleOptions(
    pendingPosts,
    contentRuns,
    getWeekStartIso()
  );

  const allowedRunIds = new Set(contentRuns.map((run) => run.id));
  const requestedRun = searchParams.run;
  const initialRun =
    requestedRun && isValidRunIdParam(requestedRun, allowedRunIds)
      ? requestedRun
      : resolveRunSelection(cycleOptions, null);

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold text-text-primary">
          Approval Queue
        </h2>
        <p className="text-sm text-text-muted">
          Review and approve content from each weekly cycle.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="text-sm text-text-muted">Loading approval queue…</div>
        }
      >
        <ApprovalDashboard
          embedded
          initialTab={resolveInitialTab(searchParams.tab)}
          initialRun={initialRun}
          initialCompany={company}
          initialBrandConfig={brandResult.data}
          initialPosts={pendingPosts}
          initialContentRuns={contentRuns}
          initialCycle={cycleResult.data}
        />
      </Suspense>
    </ClientLayout>
  );
}
