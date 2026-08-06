import { ClientCalendarView } from "@/components/client/ClientCalendarView";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getMonthScheduledRange,
  parseCalendarMonthParam,
} from "@/lib/utils/calendar";

type PageProps = {
  params: { company: string };
  searchParams: { month?: string };
};

export default async function ClientCalendarPage({
  params,
  searchParams,
}: PageProps) {
  const { sessionUser, company, pendingApprovalCount } = await getCompanyPageContext(params.company);
  const admin = createAdminClient();
  const { year, month } = parseCalendarMonthParam(searchParams.month);

  const { data: brandConfig } = await admin
    .from("brand_configs")
    .select("timezone")
    .eq("company_id", company.id)
    .maybeSingle();

  const timezone = brandConfig?.timezone ?? "America/Jamaica";
  const { start, end } = getMonthScheduledRange(timezone, year, month);

  const { data: posts } = await admin
    .from("posts")
    .select("*")
    .eq("company_id", company.id)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at", { ascending: true });

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <ClientCalendarView
        posts={posts ?? []}
        timezone={timezone}
        year={year}
        month={month}
      />
    </ClientLayout>
  );
}
