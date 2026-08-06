import { AdminPostsGrid } from "@/components/admin/AdminPostsGrid";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminPostsTabProps = {
  companyId: string;
};

export async function AdminPostsTab({ companyId }: AdminPostsTabProps) {
  const admin = createAdminClient();

  const { data: posts, error } = await admin
    .from("posts")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm text-red-700 dark:text-rose-400">
        Failed to load posts: {error.message}
      </div>
    );
  }

  return <AdminPostsGrid posts={posts ?? []} />;
}
