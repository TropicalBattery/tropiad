import { ClientCyclesView } from "@/components/client/ClientCyclesView";
import type { ContentRunWithSteps } from "@/components/client/ClientCyclesView";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { getCompanyPageContext } from "@/lib/data/company-page";
import { createAdminClient } from "@/lib/supabase/server";

type PageProps = {
  params: { company: string };
};

export default async function ClientCyclesPage({ params }: PageProps) {
  const { sessionUser, company, pendingApprovalCount } =
    await getCompanyPageContext(params.company);
  const admin = createAdminClient();

  const { data: runs } = await admin
    .from("content_runs")
    .select(
      `
      *,
      run_steps (*)
    `
    )
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const runIds = (runs ?? []).map((run) => run.id);
  const { data: posts } =
    runIds.length > 0
      ? await admin
          .from("posts")
          .select("*")
          .eq("company_id", company.id)
          .in("run_id", runIds)
      : { data: [] };

  return (
    <ClientLayout
      companySlug={params.company}
      companyName={company.name}
      sessionUser={sessionUser}
      notificationCount={pendingApprovalCount}
    >
      <div className="-mx-4 min-h-full bg-[#F3F4F6] dark:bg-[#0a0a0a] px-4 py-2 lg:-mx-8 lg:px-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#111111] dark:text-white">
              Content cycles
            </h2>
            <p className="mt-1 text-[#6b7280] dark:text-slate-400">
              History of your weekly content runs.
            </p>
          </div>

          <ClientCyclesView
            runs={(runs ?? []) as ContentRunWithSteps[]}
            posts={posts ?? []}
            companySlug={params.company}
          />
        </div>
      </div>
    </ClientLayout>
  );
}
