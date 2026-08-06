import { apiError, apiSuccess } from "@/lib/api/response";
import {
  advanceRun,
  createWeeklyRun,
} from "@/lib/agents/run-processor";
import { getSingleCompanyId } from "@/lib/config/single-company";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Drain body if present; single-client mode ignores company_id from callers.
    try {
      await request.json();
    } catch {
      // empty body is fine
    }

    const companyId = getSingleCompanyId();
    const supabase = createAdminClient();

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return apiError(companyError?.message ?? "Company not found.", 404);
    }

    const { data: brand, error: brandError } = await supabase
      .from("brand_configs")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (brandError || !brand) {
      return apiError(brandError?.message ?? "Brand config not found.", 404);
    }

    const { runId, created, statusBefore } = await createWeeklyRun(companyId);
    const result = await advanceRun(runId);

    return apiSuccess({
      run_id: runId,
      status: result.status,
      advanced: result.advanced,
      created,
      statusBefore,
      message: "Weekly pipeline run started.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to trigger cycle.";
    return apiError(message, 500);
  }
}
