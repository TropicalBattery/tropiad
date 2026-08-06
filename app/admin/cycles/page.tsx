import { redirect } from "next/navigation";

import { AdminCyclesTab } from "@/components/admin/AdminCyclesTab";
import type { ContentRunWithSteps } from "@/components/admin/AdminCyclesTab";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminCyclesPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const notificationCount = await getAdminBottleneckCount();
  const { data: runs, error } = await admin
    .from("content_runs")
    .select(
      `
      *,
      companies ( name, slug ),
      run_steps (*)
    `
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return (
      <AdminLayout
        title="Cycles"
        sessionUser={sessionUser}
        notificationCount={notificationCount}
      >
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm text-red-700 dark:text-rose-400">
          Failed to load content runs: {error.message}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Cycles"
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      <AdminCyclesTab contentRuns={(runs ?? []) as ContentRunWithSteps[]} />
    </AdminLayout>
  );
}
