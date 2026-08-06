import { redirect } from "next/navigation";

import { AdminClientsTable } from "@/components/admin/AdminClientsTable";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const [{ data }, notificationCount] = await Promise.all([
    admin
      .from("companies")
      .select("*, brand_configs(*)")
      .order("created_at", { ascending: false }),
    getAdminBottleneckCount(),
  ]);

  return (
    <AdminClientsTable
      sessionUser={sessionUser}
      clients={data ?? []}
      notificationCount={notificationCount}
    />
  );
}
