import { Suspense } from "react";

import { ClientLayout } from "@/components/layout/ClientLayout";
import { ClientSettingsView } from "@/components/client/ClientSettingsView";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { getMergedCompanyHolidays } from "@/lib/data/company-holidays";
import { createAdminClient } from "@/lib/supabase/server";

type PageProps = {
  params: { company: string };
};

function SettingsLoading() {
  return (
    <div className="-mx-4 min-h-full bg-[#F3F4F6] dark:bg-[#0a0a0a] px-4 py-2 lg:-mx-8 lg:px-8">
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-10 text-center text-[#6b7280] dark:text-slate-400">
        Loading settings...
      </div>
    </div>
  );
}

export default async function ClientSettingsPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } = await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const { data: brand } = await admin
    .from("brand_configs")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  const holidayData = await getMergedCompanyHolidays(company.id);

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      {brand ? (
        <Suspense fallback={<SettingsLoading />}>
          <ClientSettingsView
            company={company}
            brand={brand}
            initialHolidays={holidayData}
          />
        </Suspense>
      ) : (
        <div className="-mx-4 min-h-full bg-[#F3F4F6] dark:bg-[#0a0a0a] px-4 py-2 lg:-mx-8 lg:px-8">
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-10 text-center text-[#6b7280] dark:text-slate-400">
            Brand settings are not available yet for this account.
          </div>
        </div>
      )}
    </ClientLayout>
  );
}
