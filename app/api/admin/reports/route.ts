import { generateMonthlyReport } from "@/lib/agents/reporting";
import { requireAdminSession } from "@/lib/admin/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function POST(req: Request) {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  let body: { companyId?: string; month?: string };
  try {
    body = (await req.json()) as { companyId?: string; month?: string };
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { companyId, month } = body;
  if (!companyId) {
    return apiError("companyId is required", 400);
  }

  const reportMonth = month ? new Date(month) : new Date();

  try {
    const report = await generateMonthlyReport(companyId, reportMonth);
    return apiSuccess({ report });
  } catch (err) {
    console.error("[reports] Failed:", err);
    return apiError(
      err instanceof Error ? err.message : "Failed to generate report",
      500
    );
  }
}
