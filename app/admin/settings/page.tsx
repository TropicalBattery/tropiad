import { redirect } from "next/navigation";

import { AdminSettingsView } from "@/components/admin/AdminSettingsView";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!canAccessOperatorTools(sessionUser.role)) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const [{ data: companies }, notificationCount] = await Promise.all([
    admin.from("companies").select("id, name, slug").order("name", { ascending: true }),
    getAdminBottleneckCount(),
  ]);

  return (
    <AdminSettingsView
      sessionUser={sessionUser}
      companies={companies ?? []}
      notificationCount={notificationCount}
    />
  );
}
