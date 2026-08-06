import { apiError, apiSuccess } from "@/lib/api/response";
import { recoverAwaitingConnectionPosts } from "@/lib/agents/connection-recovery";
import { advanceRun } from "@/lib/agents/run-processor";
import { getPostAnalytics } from "@/lib/agents/scheduler";
import {
  sendExpiryNotification,
  sendReminderNotification,
} from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

/** Hobby ceiling is 60s; raise to 300 on Pro if advance + ideation times out. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return Boolean(process.env.CRON_SECRET) && authHeader === expected;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return apiError("Unauthorized", 401);
  }

  const admin = createAdminClient();
  const { data: runs, error } = await admin
    .from("content_runs")
    .select("id")
    .not("status", "eq", "complete")
    .not("status", "eq", "failed");

  if (error) {
    return apiError(error.message, 500);
  }

  const results: Array<{
    runId: string;
    status: string;
    advanced: boolean;
    error?: string;
  }> = [];

  for (let index = 0; index < (runs ?? []).length; index += 1) {
    const run = runs![index];

    if (index > 0) {
      await delay(500);
    }

    try {
      const result = await advanceRun(run.id);
      results.push(result);
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : "Advance run failed";
      console.error(`[cron/advance-runs] Run ${run.id} failed:`, runError);
      results.push({
        runId: run.id,
        status: "unknown",
        advanced: false,
        error: message,
      });
    }
  }

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: staleAnalyticsPosts } = await admin
    .from("posts")
    .select("id")
    .eq("pipeline_stage", "published")
    .not("zernio_post_id", "is", null)
    .or(
      `analytics_pulled_at.is.null,analytics_pulled_at.lt.${twentyFourHoursAgo.toISOString()}`
    )
    .limit(5);

  if (staleAnalyticsPosts && staleAnalyticsPosts.length > 0) {
    await Promise.allSettled(
      staleAnalyticsPosts.map((post) => getPostAnalytics(post.id))
    );
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: stalePosts } = await admin
    .from("posts")
    .select("id, run_id, company_id")
    .eq("gate1_status", "pending")
    .lt("created_at", sevenDaysAgo.toISOString());

  let expiredPostCount = 0;

  if (stalePosts && stalePosts.length > 0) {
    await admin
      .from("posts")
      .update({
        gate1_status: "rejected",
        pipeline_stage: "rejected",
        error_message: "Auto-expired after 7 days without approval",
      })
      .in(
        "id",
        stalePosts.map((post) => post.id)
      );

    const runIds = Array.from(
      new Set(
        stalePosts.map((post) => post.run_id).filter(Boolean) as string[]
      )
    );

    for (const runId of runIds) {
      const { count: remainingActive } = await admin
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("run_id", runId)
        .not("pipeline_stage", "in", '("published","rejected","failed")');

      if (remainingActive === 0) {
        await admin
          .from("content_runs")
          .update({
            status: "complete",
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }
    }

    const byCompany = stalePosts.reduce<
      Record<string, { companyId: string; count: number }>
    >((accumulator, post) => {
      if (!accumulator[post.company_id]) {
        accumulator[post.company_id] = {
          companyId: post.company_id,
          count: 0,
        };
      }
      accumulator[post.company_id].count += 1;
      return accumulator;
    }, {});

    for (const { companyId, count } of Object.values(byCompany)) {
      try {
        await sendExpiryNotification(companyId, count);
      } catch (err) {
        console.error("[expiry] notification failed:", err);
      }
    }

    expiredPostCount = stalePosts.length;
    console.log(`[expiry] Auto-expired ${stalePosts.length} stale Gate 1 posts`);
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: reminderPosts } = await admin
    .from("posts")
    .select("company_id")
    .eq("gate1_status", "pending")
    .lt("created_at", threeDaysAgo.toISOString())
    .gt("created_at", sevenDaysAgo.toISOString());

  let reminderCompanyCount = 0;

  if (reminderPosts && reminderPosts.length > 0) {
    const byCompany = reminderPosts.reduce<Record<string, number>>(
      (accumulator, post) => {
        accumulator[post.company_id] = (accumulator[post.company_id] ?? 0) + 1;
        return accumulator;
      },
      {}
    );

    for (const [companyId, count] of Object.entries(byCompany)) {
      try {
        const reminderKey = `reminder_sent_${companyId}`;
        const { data: lastReminder } = await admin
          .from("platform_settings")
          .select("value, updated_at")
          .eq("key", reminderKey)
          .maybeSingle();

        const lastSentAt = lastReminder?.updated_at
          ? new Date(lastReminder.updated_at)
          : null;

        if (lastSentAt && lastSentAt > twentyFourHoursAgo) {
          console.log(
            `[reminder] Skipping ${companyId} -- reminder sent ${lastSentAt.toISOString()}`
          );
          continue;
        }

        await sendReminderNotification(companyId, count);

        await admin.from("platform_settings").upsert(
          {
            key: reminderKey,
            value: "sent",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

        reminderCompanyCount += 1;
      } catch (err) {
        console.error("[reminder] notification failed:", err);
      }
    }
  }

  return apiSuccess({
    processed: results.length,
    results,
    connectionRecovery: await recoverAwaitingConnectionPosts(),
    stalePostExpiry: {
      expiredPosts: expiredPostCount,
      reminderCompanies: reminderCompanyCount,
    },
  });
}