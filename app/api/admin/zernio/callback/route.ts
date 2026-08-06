import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSingleCompanySlug } from "@/lib/config/single-company";
import { syncZernioAccountIds } from "@/lib/zernio/sync-accounts";

function settingsAccountsUrl(
  requestUrl: string,
  slug: string,
  connected: "success" | "error"
): URL {
  return new URL(
    `/dashboard/${slug}/settings?tab=accounts&connected=${connected}`,
    requestUrl
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const fallbackSlug = getSingleCompanySlug();

  if (!companyId) {
    return NextResponse.redirect(
      settingsAccountsUrl(request.url, fallbackSlug, "error")
    );
  }

  const admin = createAdminClient();
  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company) {
    return NextResponse.redirect(
      settingsAccountsUrl(request.url, fallbackSlug, "error")
    );
  }

  try {
    await syncZernioAccountIds(companyId);
    return NextResponse.redirect(
      settingsAccountsUrl(request.url, company.slug, "success")
    );
  } catch (error) {
    console.error("[zernio/callback] Failed to sync accounts:", error);
    return NextResponse.redirect(
      settingsAccountsUrl(request.url, company.slug, "error")
    );
  }
}
