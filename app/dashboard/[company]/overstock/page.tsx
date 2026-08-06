import { redirect } from "next/navigation";

import { ClientLayout } from "@/components/layout/ClientLayout";
import { ClientOverstockView } from "@/components/client/ClientOverstockView";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { getCompanyPageContext } from "@/lib/data/company-page";
import {
  getLatestRecommendations,
  getOverstockItems,
  getQueuedSelection,
  type OverstockItem,
  type OverstockRecommendation,
  type QueuedOverstockSelection,
} from "@/lib/queries/overstock";
import { createAdminClient } from "@/lib/supabase/server";

type PageProps = {
  params: { company: string };
};

export const dynamic = "force-dynamic";

export default async function ClientOverstockPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } =
    await getCompanyPageContext(params.company);

  if (!canAccessOperatorTools(sessionUser.role)) {
    redirect(`/dashboard/${params.company}`);
  }

  const admin = createAdminClient();

  let items: OverstockItem[] = [];
  let loadError: string | null = null;
  let queued: QueuedOverstockSelection | null = null;
  let recommendations: OverstockRecommendation[] = [];

  try {
    const [overstockItems, queuedSelection, latestRecommendations] =
      await Promise.all([
        getOverstockItems(),
        getQueuedSelection(),
        getLatestRecommendations(company.id),
      ]);
    items = overstockItems;
    queued = queuedSelection;
    recommendations = latestRecommendations;
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load overstock data.";
    try {
      queued = await getQueuedSelection();
    } catch {
      // Keep queued null if ads read also fails.
    }
    try {
      recommendations = await getLatestRecommendations(company.id);
    } catch {
      // Keep recommendations empty if ads read fails.
    }
  }

  const { data: contentRun } = await admin
    .from("content_runs")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentRunStatus = contentRun?.status ?? null;

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <ClientOverstockView
        slug={params.company}
        items={items}
        initialQueued={queued}
        initialRecommendations={recommendations}
        userEmail={sessionUser.email}
        loadError={loadError}
        currentRunStatus={currentRunStatus}
      />
    </ClientLayout>
  );
}
