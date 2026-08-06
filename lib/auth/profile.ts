import type { SupabaseClient } from "@supabase/supabase-js";

import type { SessionUser } from "@/lib/auth/user";
import {
  getPinnedCompanyBinding,
  isAllowedAppRole,
  normalizeEmail,
  parseAppRole,
} from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/types";

type DbClient = SupabaseClient<Database, "ads">;

/**
 * Resolve autopilot access from inventory `public.user_roles` by email.
 * Allowed roles: marketing | approver. Company is always Tropical Battery.
 */
export async function getProfileForClient(
  supabase: DbClient,
  userId: string,
  email: string
): Promise<SessionUser> {
  const normalized = normalizeEmail(email);
  const pinned = getPinnedCompanyBinding();

  const { data: roleRow, error } = await supabase
    .schema("public")
    .from("user_roles")
    .select("role, email")
    .eq("tenant_id", "tropical-battery")
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("[auth] user_roles lookup failed:", error.message);
  }

  const role = parseAppRole(roleRow?.role ?? null);

  if (!isAllowedAppRole(role)) {
    return {
      id: userId,
      email,
      fullName: email.split("@")[0] ?? email,
      role: null,
      companyId: null,
      companySlug: null,
      companyName: null,
    };
  }

  return {
    id: userId,
    email,
    fullName: email.split("@")[0] ?? email,
    role,
    companyId: pinned.companyId,
    companySlug: pinned.companySlug,
    companyName: pinned.companyName,
  };
}
