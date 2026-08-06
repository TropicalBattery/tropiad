// Server-only: do not import this module into client components.

import { publishPost } from "@/lib/agents/scheduler";
import {
  parseZernioAccountIds,
  resolveAccountIdForPlatform,
} from "@/lib/zernio/account-ids";
import { createAdminClient } from "@/lib/supabase/admin";

export async function recoverAwaitingConnectionPosts(): Promise<{
  checked: number;
  recovered: number;
}> {
  const admin = createAdminClient();

  const { data: posts, error: postsError } = await admin
    .from("posts")
    .select("id, company_id, platform, run_id")
    .eq("pipeline_stage", "awaiting_connection");

  if (postsError) {
    throw new Error(
      `Failed to fetch awaiting connection posts: ${postsError.message}`
    );
  }

  let recovered = 0;

  for (const post of posts ?? []) {
    const { data: brand, error: brandError } = await admin
      .from("brand_configs")
      .select("zernio_account_ids")
      .eq("company_id", post.company_id)
      .single();

    if (brandError || !brand) {
      continue;
    }

    const accountIds = parseZernioAccountIds(brand.zernio_account_ids);
    const accountId = resolveAccountIdForPlatform(accountIds, post.platform);

    if (!accountId) {
      continue;
    }

    try {
      await publishPost(post.id, {
        companyId: post.company_id,
        runId: post.run_id ?? undefined,
      });
      recovered += 1;
    } catch (error) {
      console.error(
        `[connection-recovery] Failed to publish post ${post.id}:`,
        error
      );
    }
  }

  return {
    checked: posts?.length ?? 0,
    recovered,
  };
}
