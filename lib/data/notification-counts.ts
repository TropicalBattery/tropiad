import { createAdminClient } from "@/lib/supabase/server";

export async function getPendingApprovalCount(companyId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .or("gate1_status.eq.pending,gate2_status.eq.pending");

  return count ?? 0;
}

export async function getAdminBottleneckCount(): Promise<number> {
  const admin = createAdminClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { count } = await admin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .or("gate1_status.eq.pending,gate2_status.eq.pending")
    .lt("updated_at", twentyFourHoursAgo.toISOString());

  return count ?? 0;
}
