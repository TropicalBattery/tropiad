import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { isAllowedAppRole } from "@/lib/auth/roles";
import {
  getSingleCompanySlug,
  isSingleCompanySlug,
} from "@/lib/config/single-company";
import { createAdminClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export async function assertClientCompanyAccess(
  companySlug: string
): Promise<Company> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!isAllowedAppRole(sessionUser.role)) {
    redirect("/login");
  }

  const resolvedSlug = isSingleCompanySlug(companySlug)
    ? companySlug
    : getSingleCompanySlug();

  if (!isSingleCompanySlug(companySlug)) {
    redirect(`/dashboard/${resolvedSlug}`);
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("slug", resolvedSlug)
    .maybeSingle();

  if (!company) {
    notFound();
  }

  return company;
}
