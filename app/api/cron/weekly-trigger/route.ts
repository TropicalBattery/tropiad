// Vercel Cron schedules run in UTC. The weekly-trigger schedule (0 22 * * 0)
// may need timezone-offset adjustment based on testing.

import { apiError, apiSuccess } from "@/lib/api/response";
import { createWeeklyRun } from "@/lib/agents/run-processor";
import { getSingleCompanyId } from "@/lib/config/single-company";

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
