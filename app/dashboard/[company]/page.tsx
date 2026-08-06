import { ClientDashboardView } from "@/components/client/ClientDashboardView";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";
import type { Promotion, RunStep } from "@/lib/supabase/types";
import { buildContentMixPercentages } from "@/lib/utils/client-dashboard";
import { getTodayIso } from "@/lib/validations/promotions";

type PageProps = {
  params: { company: string };
};

export default async function ClientDashboardPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } = await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const today = getTodayIso();

  const [postsResult, contentRunResult, contentMixResult, promotionsResult, brandResult, scheduledPostsResult] =
    await Promise.all([
    admin
      .from("posts")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    admin
      .from("content_runs")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("posts")
      .select("content_category")
      .eq("company_id", company.id),
    admin
      .from("promotions")
      .select("*")
      .eq("company_id", company.id)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    admin
      .from("brand_configs")
      .select("active_platforms")
      .eq("company_id", company.id)
      .maybeSingle(),
    admin
      .from("posts")
      .select(
        "id, concept, caption, platform, content_type, scheduled_at, image_url, pipeline_stage"
      )
      .eq("company_id", company.id)
      .eq("gate2_status", "approved")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(6),
  ]);

  const contentMix = buildContentMixPercentages(contentMixResult.data ?? []);
  const promotions = Array.isArray(promotionsResult.data)
    ? (promotionsResult.data as Promotion[])
    : [];

  const contentRun = contentRunResult.data;
  let runSteps: RunStep[] = [];

  if (contentRun) {
    const { data: steps } = await admin
      .from("run_steps")
      .select("*")
      .eq("run_id", contentRun.id)
      .order("created_at", { ascending: true });

    runSteps = steps ?? [];
  }

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <ClientDashboardView
        slug={params.company}
        company={company}
        posts={postsResult.data ?? []}
        contentRun={contentRun}
        runSteps={runSteps}
        contentMix={contentMix}
        promotions={promotions}
        activePlatforms={brandResult.data?.active_platforms ?? []}
        scheduledPosts={scheduledPostsResult.data ?? []}
      />
    </ClientLayout>
  );
}
