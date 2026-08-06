// Server-only: do not import this module into client components.
//
// DATABASE MIGRATION (comment only, do not run):
// -- alter table brand_configs add column if not exists zernio_profile_id text;

import { getZernioClient } from "@/lib/zernio/client";
import { createAdminClient } from "@/lib/supabase/admin";

async function clearStoredZernioProfileId(companyId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("brand_configs")
    .update({
      zernio_profile_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (error) {
    throw new Error(
      `Failed to clear stale Zernio profile id: ${error.message}`
    );
  }
}

async function createAndStoreZernioProfile(
  companyId: string,
  companyName: string
): Promise<string> {
  const admin = createAdminClient();
  const zernio = getZernioClient();
  const { data, error } = await zernio.profiles.createProfile({
    body: { name: companyName },
  });

  if (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof error.error === "string"
        ? error.error
        : "Failed to create Zernio profile.";
    throw new Error(message);
  }

  const profileId = data?.profile?._id;
  if (!profileId) {
    throw new Error("Zernio did not return a profile id.");
  }

  const { error: updateError } = await admin
    .from("brand_configs")
    .update({
      zernio_profile_id: profileId,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (updateError) {
    throw new Error(`Failed to save Zernio profile id: ${updateError.message}`);
  }

  return profileId;
}

export async function ensureZernioProfile(
  companyId: string,
  companyName: string,
  options?: { recreate?: boolean }
): Promise<string> {
  const admin = createAdminClient();

  const { data: brand, error: brandError } = await admin
    .from("brand_configs")
    .select("zernio_profile_id")
    .eq("company_id", companyId)
    .single();

  if (brandError || !brand) {
    throw new Error(
      brandError?.message ?? `Brand config not found for company ${companyId}.`
    );
  }

  if (options?.recreate) {
    await clearStoredZernioProfileId(companyId);
    return createAndStoreZernioProfile(companyId, companyName);
  }

  if (brand.zernio_profile_id) {
    return brand.zernio_profile_id;
  }

  return createAndStoreZernioProfile(companyId, companyName);
}

export function isZernioProfileAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /profile not found|access denied/i.test(message);
}
