import { redirect } from "next/navigation";

import { AdminPostsClient } from "@/components/admin/AdminPostsClient";
import type { PostWithCompany } from "@/components/admin/AdminGlobalPostsGrid";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const notificationCount = await getAdminBottleneckCount();
  const { data: posts, error } = await admin
    .from("posts")
    .select(
      `
      *,
      companies ( name, slug )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <AdminPostsClient
        sessionUser={sessionUser}
        posts={[]}
        errorMessage={error.message}
        notificationCount={notificationCount}
      />
    );
  }

  return (
    <AdminPostsClient
      sessionUser={sessionUser}
      posts={(posts ?? []) as PostWithCompany[]}
      notificationCount={notificationCount}
    />
  );
}
