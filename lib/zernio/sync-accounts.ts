// Server-only: do not import this module into client components.

import {
  buildAccountIdsFromAccounts,
} from "@/lib/zernio/account-ids";
import { listZernioAccounts } from "@/lib/zernio/connect";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export async function syncZernioAccountIds(companyId: string): Promise<void> {
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

  if (!brand.zernio_profile_id) {
    throw new Error("Company does not have a Zernio profile yet.");
  }

  const accounts = await listZernioAccounts(brand.zernio_profile_id);
  const zernioAccountIds = buildAccountIdsFromAccounts(accounts);

  const { error: updateError } = await admin
    .from("brand_configs")
    .update({
      zernio_account_ids: zernioAccountIds as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (updateError) {
    throw new Error(`Failed to sync Zernio accounts: ${updateError.message}`);
  }
}
