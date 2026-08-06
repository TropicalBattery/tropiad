import { ClientPostsView } from "@/components/client/ClientPostsView";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";

type PageProps = {
  params: { company: string };
};

export default async function ClientPostsPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } = await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const { data: posts } = await admin
    .from("posts")
    .select(
      "id, concept, caption, platform, content_type, image_url, video_url, scheduled_at, published_at, pipeline_stage, impressions, reach, engagement, clicks, analytics_pulled_at, gate1_status, gate2_status"
    )
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <ClientPostsView company={company} posts={posts ?? []} />
    </ClientLayout>
  );
}
