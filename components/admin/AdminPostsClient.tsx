"use client";

import { AdminGlobalPostsGrid } from "@/components/admin/AdminGlobalPostsGrid";
import type { PostWithCompany } from "@/components/admin/AdminGlobalPostsGrid";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { SessionUser } from "@/lib/auth/user";

type AdminPostsClientProps = {
  sessionUser: SessionUser;
  posts: PostWithCompany[];
  errorMessage?: string | null;
  notificationCount?: number;
};

export function AdminPostsClient({
  sessionUser,
  posts,
  errorMessage,
  notificationCount = 0,
}: AdminPostsClientProps) {
  return (
    <AdminLayout
      title="Posts"
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      {errorMessage ? (
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm text-red-700 dark:text-rose-400">
          Failed to load posts: {errorMessage}
        </div>
      ) : (
        <AdminGlobalPostsGrid posts={posts} />
      )}
    </AdminLayout>
  );
}
