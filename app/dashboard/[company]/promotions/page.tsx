import { ClientLayout } from "@/components/layout/ClientLayout";
import { ClientPromotionsView } from "@/components/client/ClientPromotionsView";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";
import type { Promotion } from "@/lib/supabase/types";

type PageProps = {
  params: { company: string };
};

export default async function ClientPromotionsPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } = await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const [promotionsResult, brandResult] = await Promise.all([
    admin
      .from("promotions")
      .select("*")
      .eq("company_id", company.id)
      .order("start_date", { ascending: false }),
    admin
      .from("brand_configs")
      .select("active_platforms")
      .eq("company_id", company.id)
      .maybeSingle(),
  ]);

  const promotions = Array.isArray(promotionsResult.data)
    ? (promotionsResult.data as Promotion[])
    : [];

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <ClientPromotionsView
        companyId={company.id}
        initialPromotions={promotions}
        activePlatforms={brandResult.data?.active_platforms ?? []}
      />
    </ClientLayout>
  );
}
