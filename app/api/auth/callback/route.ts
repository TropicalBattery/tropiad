import { NextResponse } from "next/server";

import { getProfileForClient } from "@/lib/auth/profile";
import { getSingleCompanySlug } from "@/lib/config/single-company";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const profile = await getProfileForClient(admin, user.id, user.email);

  return NextResponse.json({
    role: profile.role,
    slug: getSingleCompanySlug(),
  });
}
