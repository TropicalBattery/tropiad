import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/user";
import { getPendingApprovalCount } from "@/lib/data/notification-counts";
import {
  getSingleCompanySlug,
  isSingleCompanySlug,
} from "@/lib/config/single-company";
import { createAdminClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export async function getCompanyPageContext(
  slug: string
): Promise<{
  sessionUser: SessionUser;
  company: Company;
  pendingApprovalCount: number;
}> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  // Single-client mode: never load another company's dashboard by slug.
  if (!isSingleCompanySlug(slug)) {
    redirect(`/dashboard/${getSingleCompanySlug()}`);
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("slug", getSingleCompanySlug())
    .maybeSingle();

  if (!company) {
    notFound();
  }

  const pendingApprovalCount = await getPendingApprovalCount(company.id);

  return { sessionUser, company, pendingApprovalCount };
}
