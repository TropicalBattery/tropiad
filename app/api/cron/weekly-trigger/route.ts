// Weekly trigger is scheduled externally (Supabase Cron / pg_cron). Schedules
// run in UTC — adjust offset based on testing.

import { apiError, apiSuccess } from "@/lib/api/response";
import { createWeeklyRun } from "@/lib/agents/run-processor";
import { getSingleCompanyId } from "@/lib/config/single-company";

/** Hobby ceiling is 60s; raise to 300 on Pro if needed. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return Boolean(process.env.CRON_SECRET) && authHeader === expected;
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return apiError("Unauthorized", 401);
  }

  const companyId = getSingleCompanyId();

  try {
    await createWeeklyRun(companyId);
    return apiSuccess({ runsEnsured: 1, companyId });
  } catch (cronError) {
    console.error(
      `[cron/weekly-trigger] Failed for company ${companyId}:`,
      cronError
    );
    const message =
      cronError instanceof Error ? cronError.message : "Weekly trigger failed.";
    return apiError(message, 500);
  }
}
