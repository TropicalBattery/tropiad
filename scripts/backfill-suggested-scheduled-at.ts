import { config } from "dotenv";

config({ path: ".env.local" });

import { buildSuggestedScheduledAt } from "../lib/agents/scheduling-heuristics";
import { parsePreferredTimes } from "../lib/onboarding/completeness";
import { normalizeIndustries } from "../lib/validations/brand-config-normalize";
import { createAdminClient } from "../lib/supabase/admin";

const POST_ID_PREFIXES = ["97d6871f", "633da157"];

async function main(): Promise<void> {
  const admin = createAdminClient();

  const { data: allReadyPosts, error: readyError } = await admin
    .from("posts")
    .select("id, platform, pipeline_stage, run_id, company_id")
    .eq("pipeline_stage", "ready");

  if (readyError) {
    throw new Error(readyError.message);
  }

  const targets = (allReadyPosts ?? []).filter((post) =>
    POST_ID_PREFIXES.some((prefix) => post.id.startsWith(prefix))
  );

  if (targets.length === 0) {
    throw new Error(
      `No ready posts found matching prefixes: ${POST_ID_PREFIXES.join(", ")}`
    );
  }

  const results: Array<{ id: string; suggested_scheduled_at: string }> = [];

  for (const post of targets) {
    if (!post.run_id) {
      throw new Error(`Post ${post.id} has no run_id.`);
    }

    const { data: run, error: runError } = await admin
      .from("content_runs")
      .select("week_start")
      .eq("id", post.run_id)
      .single();

    if (runError || !run) {
      throw new Error(runError?.message ?? `Run not found for post ${post.id}`);
    }

    const { data: brandConfig, error: brandError } = await admin
      .from("brand_configs")
      .select("*")
      .eq("company_id", post.company_id)
      .single();

    if (brandError || !brandConfig) {
      throw new Error(
        brandError?.message ?? `Brand config not found for post ${post.id}`
      );
    }

    const { data: tagRow, error: tagError } = await admin
      .from("posts")
      .select("suggested_time_tag")
      .eq("id", post.id)
      .maybeSingle();

    const timeTag =
      tagError || !tagRow?.suggested_time_tag
        ? "anytime"
        : tagRow.suggested_time_tag;

    const preferredTimes = parsePreferredTimes(brandConfig.preferred_times);
    const suggestedScheduledAt = buildSuggestedScheduledAt({
      weekStart: run.week_start,
      timezone: brandConfig.timezone,
      industry: normalizeIndustries(brandConfig.industry),
      timeTag,
      preferredTimes,
      postFrequency: brandConfig.post_frequency,
      platform: post.platform,
    });

    const { error: updateError } = await admin
      .from("posts")
      .update({
        suggested_scheduled_at: suggestedScheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (updateError) {
      throw new Error(
        `Failed to update post ${post.id}: ${updateError.message}`
      );
    }

    results.push({
      id: post.id,
      suggested_scheduled_at: suggestedScheduledAt,
    });
  }

  for (const result of results) {
    console.log(`${result.id}: ${result.suggested_scheduled_at}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
