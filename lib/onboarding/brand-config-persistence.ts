import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { BrandConfig, Database, Json } from "@/lib/supabase/types";

type AdsClient = SupabaseClient<Database, "ads">;

export function isSectionsConfirmedColumnMissing(
  error: PostgrestError | null | undefined
): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    error.message.includes("sections_confirmed")
  );
}

export function stripSectionsConfirmed(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const rest = { ...fields };
  delete rest.sections_confirmed;
  return rest;
}

export async function updateBrandConfigRow(
  admin: AdsClient,
  companyId: string,
  fields: Record<string, unknown>
): Promise<{ data: BrandConfig | null; error: PostgrestError | null }> {
  const payload = {
    ...fields,
    updated_at: new Date().toISOString(),
  } as Database["ads"]["Tables"]["brand_configs"]["Update"];

  let result = await admin
    .from("brand_configs")
    .update(payload)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (
    result.error &&
    isSectionsConfirmedColumnMissing(result.error) &&
    "sections_confirmed" in payload
  ) {
    result = await admin
      .from("brand_configs")
      .update(
        stripSectionsConfirmed(payload) as Database["ads"]["Tables"]["brand_configs"]["Update"]
      )
      .eq("company_id", companyId)
      .select("*")
      .single();
  }

  return result as { data: BrandConfig | null; error: PostgrestError | null };
}

export async function readSectionsConfirmed(
  admin: AdsClient,
  companyId: string
): Promise<Json | undefined> {
  const { data, error } = await admin
    .from("brand_configs")
    .select("sections_confirmed")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error && isSectionsConfirmedColumnMissing(error)) {
    return undefined;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data?.sections_confirmed;
}
