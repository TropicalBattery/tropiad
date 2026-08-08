// Server-only: do not import this module into client components.
//
// DATABASE MIGRATION (comment only, do not run):
// -- create table content_runs (
// --   id uuid primary key default gen_random_uuid(),
// --   company_id uuid references companies(id) on delete cascade,
// --   week_start date not null,
// --   status text not null default 'pending',
// --   trend_brief jsonb,
// --   locked_at timestamptz,
// --   locked_by text,
// --   completed_at timestamptz,
// --   created_at timestamptz default now(),
// --   updated_at timestamptz default now()
// -- );
// -- create unique index uniq_content_runs_company_week
// --   on content_runs(company_id, week_start);
// -- create table run_steps (...);
// -- alter table posts add column if not exists run_id uuid references content_runs(id);
// -- create table cost_events (...);

import { startOfWeek, format } from "date-fns";

import { generateCaption, generateConcepts, type Platform } from "@/lib/agents/copywriter";
import {
  completeStep,
  failStep,
  getStepStatus,
  startStep,
} from "@/lib/agents/run-steps";
import { publishPost } from "@/lib/agents/scheduler";
import {
  parseZernioAccountIds,
  resolveAccountIdForPlatform,
} from "@/lib/zernio/account-ids";
import type { TrendBrief } from "@/lib/agents/types";
import {
  renderTrendBriefBullets,
  runTrendScout,
} from "@/lib/agents/trend-scout";
import {
  getLatestQueuedSelection,
  markOverstockConsumed,
  resolveProductNamesForSkus,
} from "@/lib/queries/overstock";
import { buildSuggestedScheduledAt } from "@/lib/agents/scheduling-heuristics";
import { markPostFailed, produceVisual } from "@/lib/agents/visual";
import { buildGate1Email, getNotificationRecipients } from "@/lib/email/templates";
import { getResendFromAddress, getNotificationSettings } from "@/lib/email/config";
import { parsePreferredTimes } from "@/lib/onboarding/completeness";
import { normalizeIndustries } from "@/lib/validations/brand-config-normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandConfig, ContentRun, Json, Post } from "@/lib/supabase/types";
import { Resend } from "resend";

function getWeekStartDate(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function parseTrendBrief(value: Json | null): TrendBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const brief = value as Record<string, unknown>;
  if (
    typeof brief.generated_at !== "string" ||
    typeof brief.industry !== "string" ||
    typeof brief.raw_text !== "string" ||
    typeof brief.fallback_used !== "boolean" ||
    !Array.isArray(brief.angles)
  ) {
    return null;
  }

  return brief as TrendBrief;
}

function toPlatform(platform: string): Platform {
  const key = platform.trim().toLowerCase();
  if (key === "instagram") return "instagram";
  if (key === "linkedin") return "linkedin";
  if (key === "x" || key === "twitter") return "x";
  if (key === "facebook") return "facebook";
  return "instagram";
}

function normalizeContentType(
  value: string
): "image" | "video" | "carousel" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "carousel") return "carousel";
  return "image";
}

async function fetchRunStatus(runId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("content_runs")
    .select("status")
    .eq("id", runId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Run ${runId} not found.`);
  }

  return data.status;
}

async function clearRunLock(runId: string, lockerId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("content_runs")
    .update({
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("locked_by", lockerId);
}

async function acquireRunLock(
  runId: string,
  lockerId: string
): Promise<ContentRun | null> {
  const admin = createAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("content_runs")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: lockerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .neq("status", "complete")
    .neq("status", "failed")
    .or(`locked_at.is.null,locked_at.lt.${tenMinutesAgo}`)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to acquire run lock: ${error.message}`);
  }

  return data;
}

async function handlePendingRun(
  run: ContentRun,
  brandConfig: BrandConfig
): Promise<{ advanced: boolean; status: string }> {
  const admin = createAdminClient();
  let brief: TrendBrief | null = parseTrendBrief(run.trend_brief);
  const trendStep = await getStepStatus(run.id, "trend_research");

  if (trendStep?.status !== "succeeded") {
    const trendStepId = await startStep(run.id, "trend_research", {
      companyId: run.company_id,
    });

    try {
      brief = await runTrendScout(brandConfig, {
        companyId: run.company_id,
        runId: run.id,
      });

      const { error: briefError } = await admin
        .from("content_runs")
        .update({
          trend_brief: brief as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      if (briefError) {
        throw new Error(`Failed to save trend brief: ${briefError.message}`);
      }

      await completeStep(trendStepId, {
        fallback_used: brief.fallback_used,
      });
    } catch (error) {
      await failStep(trendStepId, error);
      return { advanced: false, status: run.status };
    }
  }

  if (!brief) {
    brief = parseTrendBrief(run.trend_brief);
  }

  if (!brief) {
    throw new Error("Trend brief missing after trend research step.");
  }

  const ideationStepId = await startStep(run.id, "ideation", {
    trendBrief: renderTrendBriefBullets(brief),
  });

  try {
    const queuedOverstock = await getLatestQueuedSelection(run.company_id);
    let overstockContext: {
      skus: string[];
      productNames: string[];
      postCount: number;
      strategy?: {
        campaign_angle: string;
        target_audience: string;
        customer_problem: string;
        narrative: string;
      } | null;
      sourceRecommendationId?: string | null;
    } | null = null;

    if (queuedOverstock && queuedOverstock.skus.length > 0) {
      const productNames = await resolveProductNamesForSkus(
        queuedOverstock.skus
      );
      overstockContext = {
        skus: queuedOverstock.skus,
        productNames,
        postCount: queuedOverstock.post_count,
        ...(queuedOverstock.campaign_strategy
          ? { strategy: queuedOverstock.campaign_strategy }
          : {}),
        ...(queuedOverstock.source_recommendation_id
          ? {
              sourceRecommendationId:
                queuedOverstock.source_recommendation_id,
            }
          : {}),
      };
    }

    const concepts = await generateConcepts(
      run.company_id,
      run.id,
      brief,
      run.week_start,
      overstockContext
    );
    await completeStep(ideationStepId, {
      conceptsGenerated: concepts.length,
      overstockSelectionId: queuedOverstock?.id ?? null,
    });

    if (queuedOverstock) {
      await markOverstockConsumed(queuedOverstock.id, run.id);
    }

    const { error: statusError } = await admin
      .from("content_runs")
      .update({
        status: "gate1_pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    if (statusError) {
      throw new Error(`Failed to update run status: ${statusError.message}`);
    }

    await startStep(run.id, "gate1_review");

    const notifSettings = await getNotificationSettings();
    if (notifSettings.gate1_email) {
      try {
        const { data: company } = await admin
          .from("companies")
          .select("name, owner_email, slug")
          .eq("id", run.company_id)
          .single();

        const { count: conceptCount } = await admin
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("run_id", run.id)
          .eq("gate1_status", "pending");

        if (company?.owner_email && process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          const allRecipients = await getNotificationRecipients(
            run.company_id,
            company.owner_email
          );

          if (allRecipients.length > 0) {
            const senderEmail = await getResendFromAddress();

            await resend.emails.send({
              from: senderEmail,
              to: allRecipients,
              subject: `Your ${conceptCount ?? 0} content concepts are ready to review`,
              html: buildGate1Email({
                companyName: company.name,
                conceptCount: conceptCount ?? 0,
                reviewUrl: `${appUrl}/dashboard/${company.slug}/approve`,
              }),
            });
          }
        }
      } catch (err) {
        console.error("[notify] Gate 1 email failed:", err);
      }
    }

    return { advanced: true, status: "gate1_pending" };
  } catch (error) {
    await failStep(ideationStepId, error);

    await admin
      .from("content_runs")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return { advanced: false, status: "failed" };
  }
}

async function persistSuggestedScheduledAt(
  post: Pick<Post, "id" | "platform" | "suggested_time_tag">,
  run: Pick<ContentRun, "week_start">,
  brandConfig: BrandConfig
): Promise<void> {
  const admin = createAdminClient();
  const preferredTimes = parsePreferredTimes(brandConfig.preferred_times);
  const suggestedScheduledAt = buildSuggestedScheduledAt({
    weekStart: run.week_start,
    timezone: brandConfig.timezone,
    industry: normalizeIndustries(brandConfig.industry),
    timeTag: post.suggested_time_tag ?? "anytime",
    preferredTimes,
    postFrequency: brandConfig.post_frequency,
    platform: post.platform,
  });

  const { error } = await admin
    .from("posts")
    .update({
      suggested_scheduled_at: suggestedScheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id);

  if (error) {
    throw new Error(
      `Failed to persist suggested_scheduled_at for post ${post.id}: ${error.message}`
    );
  }
}

async function runCaptionGeneration(
  runId: string,
  post: Pick<Post, "id" | "company_id" | "platform" | "concept">
): Promise<void> {
  const captionStepId = await startStep(runId, "caption_generation", {
    postId: post.id,
  });
  try {
    await generateCaption(
      post.company_id,
      post.id,
      toPlatform(post.platform),
      post.concept ?? ""
    );
    await completeStep(captionStepId, { postId: post.id });
  } catch (err) {
    await failStep(captionStepId, err);
    throw err;
  }
}

async function runVisualProduction(
  runId: string,
  post: Post,
  brandConfig: BrandConfig
): Promise<void> {
  const visualStepId = await startStep(runId, "visual_production", {
    postId: post.id,
  });
  const contentType = normalizeContentType(post.content_type);
  try {
    await produceVisual({
      postId: post.id,
      companyId: post.company_id,
      concept: post.concept ?? "",
      contentType,
      brandConfig,
      context: {
        companyId: post.company_id,
        runId,
        postId: post.id,
      },
    });

    if (contentType === "video") {
      const admin = createAdminClient();
      const { data: afterKickoff, error: afterError } = await admin
        .from("posts")
        .select("video_operation_id, pipeline_stage")
        .eq("id", post.id)
        .single();

      if (
        afterError ||
        !afterKickoff?.video_operation_id ||
        afterKickoff.pipeline_stage !== "producing"
      ) {
        const message =
          "Video kickoff completed without a persisted operation id";
        await markPostFailed(post.id, message);
        throw new Error(message);
      }
    }

    await completeStep(visualStepId, { postId: post.id });
  } catch (err) {
    await failStep(visualStepId, err);
    throw err;
  }
}

async function runPublishing(
  runId: string,
  postId: string,
  context?: { companyId: string; runId: string }
): Promise<void> {
  const publishStepId = await startStep(runId, "publishing");
  try {
    if (context) {
      await publishPost(postId, context);
    } else {
      await publishPost(postId);
    }
    await completeStep(publishStepId, { postId });
  } catch (err) {
    await failStep(publishStepId, err);
    console.error(`[advanceRun] publish failed for ${postId}:`, err);
  }
}

async function sweepReadyApprovedPosts(runId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: readyToPublish } = await admin
    .from("posts")
    .select("*")
    .eq("run_id", runId)
    .eq("gate2_status", "approved")
    .eq("pipeline_stage", "ready")
    .limit(3);

  if (readyToPublish && readyToPublish.length > 0) {
    for (const post of readyToPublish) {
      await runPublishing(runId, post.id);
    }
  }
}

async function handleGate1PendingRun(
  run: ContentRun,
  brandConfig: BrandConfig
): Promise<{ advanced: boolean; status: string }> {
  const admin = createAdminClient();

  const { data: ideationPost, error: ideationError } = await admin
    .from("posts")
    .select("*")
    .eq("run_id", run.id)
    .eq("gate1_status", "approved")
    .eq("pipeline_stage", "ideation")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ideationError) {
    throw new Error(`Failed to fetch approved posts: ${ideationError.message}`);
  }

  let nextPost = ideationPost;

  if (!nextPost) {
    const { data: visualPost, error: visualError } = await admin
      .from("posts")
      .select("*")
      .eq("run_id", run.id)
      .eq("gate1_status", "approved")
      .eq("pipeline_stage", "visual")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (visualError) {
      throw new Error(
        `Failed to fetch visual-stage posts: ${visualError.message}`
      );
    }

    nextPost = visualPost;
  }

  if (!nextPost) {
    return { advanced: false, status: run.status };
  }

  if (nextPost.pipeline_stage === "ideation") {
    await runCaptionGeneration(run.id, nextPost);
  }

  await runVisualProduction(run.id, nextPost, brandConfig);

  const { data: processedPost, error: processedError } = await admin
    .from("posts")
    .select("id, platform, pipeline_stage, suggested_time_tag")
    .eq("id", nextPost.id)
    .single();

  if (processedError || !processedPost) {
    throw new Error(
      processedError?.message ??
        `Failed to fetch post ${nextPost.id} after visual production.`
    );
  }

  if (processedPost.pipeline_stage === "ready") {
    await persistSuggestedScheduledAt(processedPost, run, brandConfig);
  }

  const { data: approvedPosts, error: approvedError } = await admin
    .from("posts")
    .select("pipeline_stage")
    .eq("run_id", run.id)
    .eq("gate1_status", "approved");

  if (approvedError) {
    throw new Error(
      `Failed to check approved post stages: ${approvedError.message}`
    );
  }

  const allProcessed =
    (approvedPosts ?? []).length > 0 &&
    (approvedPosts ?? []).every((post) =>
      ["ready", "producing", "failed"].includes(post.pipeline_stage)
    );

  if (allProcessed) {
    const { error: statusError } = await admin
      .from("content_runs")
      .update({
        status: "gate2_pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    if (statusError) {
      throw new Error(`Failed to update run status: ${statusError.message}`);
    }

    const gate1ReviewStep = await getStepStatus(run.id, "gate1_review");
    if (gate1ReviewStep) {
      await completeStep(gate1ReviewStep.id, { advancedTo: "gate2_pending" });
    }
    await startStep(run.id, "gate2_review");

    return { advanced: true, status: "gate2_pending" };
  }

  return { advanced: true, status: run.status };
}

async function handleGate2PendingRun(
  run: ContentRun
): Promise<{ advanced: boolean; status: string }> {
  const admin = createAdminClient();

  const { data: brandConfig, error: brandError } = await admin
    .from("brand_configs")
    .select("zernio_account_ids")
    .eq("company_id", run.company_id)
    .single();

  if (brandError || !brandConfig) {
    throw new Error(
      brandError?.message ??
        `Brand config not found for company ${run.company_id}.`
    );
  }

  const accountIds = parseZernioAccountIds(brandConfig.zernio_account_ids);

  const { data: publishCandidates, error: publishError } = await admin
    .from("posts")
    .select("id, platform")
    .eq("run_id", run.id)
    .eq("gate2_status", "approved")
    .eq("pipeline_stage", "ready")
    .order("created_at", { ascending: true })
    .limit(3);

  if (publishError) {
    throw new Error(
      `Failed to fetch publish candidates: ${publishError.message}`
    );
  }

  if ((publishCandidates ?? []).length > 0) {
    const { error: publishingStatusError } = await admin
      .from("content_runs")
      .update({
        status: "publishing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    if (publishingStatusError) {
      throw new Error(
        `Failed to update run status: ${publishingStatusError.message}`
      );
    }
  }

  for (const post of publishCandidates ?? []) {
    const accountId = resolveAccountIdForPlatform(accountIds, post.platform);

    if (!accountId) {
      await admin
        .from("posts")
        .update({
          pipeline_stage: "awaiting_connection",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);
      continue;
    }

    await runPublishing(run.id, post.id, {
      companyId: run.company_id,
      runId: run.id,
    });
  }

  const { count: remainingCount, error: remainingError } = await admin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("gate2_status", "approved")
    .not("pipeline_stage", "in", "(published,failed,rejected)");

  if (remainingError) {
    throw new Error(
      `Failed to count remaining approved posts: ${remainingError.message}`
    );
  }

  if ((remainingCount ?? 0) === 0) {
    const now = new Date().toISOString();
    const { error: statusError } = await admin
      .from("content_runs")
      .update({
        status: "complete",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", run.id);

    if (statusError) {
      throw new Error(`Failed to complete run: ${statusError.message}`);
    }

    const gate2ReviewStep = await getStepStatus(run.id, "gate2_review");
    if (gate2ReviewStep) {
      await completeStep(gate2ReviewStep.id, { status: "complete" });
    }

    return { advanced: true, status: "complete" };
  }

  const nextStatus =
    (publishCandidates ?? []).length > 0 ? "publishing" : run.status;

  return { advanced: true, status: nextStatus };
}

export type CreateWeeklyRunResult = {
  runId: string;
  created: boolean;
  statusBefore: string | null;
};

export async function createWeeklyRun(
  companyId: string
): Promise<CreateWeeklyRunResult> {
  const admin = createAdminClient();
  const weekStart = getWeekStartDate();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await admin
    .from("content_runs")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Failed to look up weekly run: ${existingError.message}`
    );
  }

  const created = !existing;
  const statusBefore = existing?.status ?? null;

  const { error: upsertError } = await admin.from("content_runs").upsert(
    {
      company_id: companyId,
      week_start: weekStart,
      status: "pending",
      updated_at: now,
    },
    {
      onConflict: "company_id,week_start",
      ignoreDuplicates: true,
    }
  );

  if (upsertError) {
    throw new Error(`Failed to ensure weekly run: ${upsertError.message}`);
  }

  const { data: run, error: selectError } = await admin
    .from("content_runs")
    .select("id")
    .eq("company_id", companyId)
    .eq("week_start", weekStart)
    .single();

  if (selectError || !run) {
    throw new Error(
      selectError?.message ?? "Failed to load weekly run after upsert."
    );
  }

  return { runId: run.id, created, statusBefore };
}

export async function advanceRun(
  runId: string
): Promise<{ runId: string; status: string; advanced: boolean }> {
  const lockerId = `${process.env.VERCEL_REGION ?? "local"}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const lockedRun = await acquireRunLock(runId, lockerId);

  if (!lockedRun) {
    const status = await fetchRunStatus(runId);
    return { runId, status, advanced: false };
  }

  try {
    if (lockedRun.status === "complete" || lockedRun.status === "failed") {
      return { runId, status: lockedRun.status, advanced: false };
    }

    const admin = createAdminClient();
    const { data: brandConfig, error: brandError } = await admin
      .from("brand_configs")
      .select("*")
      .eq("company_id", lockedRun.company_id)
      .single();

    if (brandError || !brandConfig) {
      throw new Error(
        brandError?.message ??
          `Brand config not found for company ${lockedRun.company_id}.`
      );
    }

    let runStatus = lockedRun.status;

    const { count: stillProducing, error: stillProducingError } = await admin
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("run_id", lockedRun.id)
      .eq("gate1_status", "approved")
      .in("pipeline_stage", ["ideation", "producing"]);

    if (stillProducingError) {
      throw new Error(
        `Failed to count posts still in production: ${stillProducingError.message}`
      );
    }

    if ((stillProducing ?? 0) > 0 && runStatus === "gate2_pending") {
      const { error: regressionError } = await admin
        .from("content_runs")
        .update({
          status: "gate1_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lockedRun.id);

      if (regressionError) {
        throw new Error(
          `Failed to regress run status: ${regressionError.message}`
        );
      }

      runStatus = "gate1_pending";
    }

    const { data: approvedPendingProduction, error: pendingProductionError } =
      await admin
        .from("posts")
        .select("*")
        .eq("run_id", lockedRun.id)
        .eq("gate1_status", "approved")
        .eq("pipeline_stage", "ideation")
        .is("caption", null)
        .order("created_at", { ascending: true })
        .limit(1);

    if (pendingProductionError) {
      throw new Error(
        `Failed to fetch posts pending production: ${pendingProductionError.message}`
      );
    }

    if (approvedPendingProduction && approvedPendingProduction.length > 0) {
      const post = approvedPendingProduction[0];

      await runCaptionGeneration(lockedRun.id, post);

      await runVisualProduction(lockedRun.id, post, brandConfig);

      const { data: processedPost, error: processedError } = await admin
        .from("posts")
        .select("id, platform, pipeline_stage, suggested_time_tag")
        .eq("id", post.id)
        .single();

      if (processedError || !processedPost) {
        throw new Error(
          processedError?.message ??
            `Failed to fetch post ${post.id} after visual production.`
        );
      }

      if (processedPost.pipeline_stage === "ready") {
        await persistSuggestedScheduledAt(processedPost, lockedRun, brandConfig);
      }

      if (runStatus === "gate1_pending") {
        await sweepReadyApprovedPosts(lockedRun.id);
      }

      return {
        runId,
        status: runStatus,
        advanced: true,
      };
    }

    const activeRun: ContentRun = { ...lockedRun, status: runStatus };
    let result: { advanced: boolean; status: string };

    switch (runStatus) {
      case "pending":
        result = await handlePendingRun(activeRun, brandConfig);
        break;
      case "gate1_pending":
        result = await handleGate1PendingRun(activeRun, brandConfig);
        await sweepReadyApprovedPosts(lockedRun.id);
        break;
      case "gate2_pending":
      case "publishing":
        result = await handleGate2PendingRun(activeRun);
        await sweepReadyApprovedPosts(lockedRun.id);
        break;
      default:
        result = { advanced: false, status: runStatus };
        break;
    }

    return {
      runId,
      status: result.status,
      advanced: result.advanced,
    };
  } finally {
    await clearRunLock(runId, lockerId);
  }
}
