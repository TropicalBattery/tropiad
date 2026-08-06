import { ClientAnalyticsView } from "@/components/client/ClientAnalyticsView";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";

type PageProps = {
  params: { company: string };
};

export default async function ClientAnalyticsPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } = await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const { data: posts } = await admin
    .from("posts")
    .select(
      "id, concept, platform, content_type, image_url, published_at, impressions, reach, engagement, clicks, content_category"
    )
    .eq("company_id", company.id)
    .eq("pipeline_stage", "published")
    .order("published_at", { ascending: false });

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <ClientAnalyticsView posts={posts ?? []} />
    </ClientLayout>
  );
}
