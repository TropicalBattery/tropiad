import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertClientCompanyAccess } from "@/lib/data/client-settings-access";
import { getMergedCompanyHolidays } from "@/lib/data/company-holidays";
import { createAdminClient } from "@/lib/supabase/server";

const patchHolidaySchema = z.object({
  holiday_id: z.string().uuid(),
  enabled: z.boolean(),
  custom_name: z.string().nullable().optional(),
});

type RouteContext = {
  params: { company: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const company = await assertClientCompanyAccess(context.params.company);
    const holidays = await getMergedCompanyHolidays(company.id);
    return apiSuccess(holidays);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch holidays.";
    return apiError(message, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const company = await assertClientCompanyAccess(context.params.company);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const parsed = patchHolidaySchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => issue.message).join(". ") ||
        "Invalid request body";
      return apiError(message, 400);
    }

    const admin = createAdminClient();
    const { error } = await admin.from("company_holidays").upsert(
      {
        company_id: company.id,
        holiday_id: parsed.data.holiday_id,
        enabled: parsed.data.enabled,
        custom_name: parsed.data.custom_name ?? null,
      },
      { onConflict: "company_id,holiday_id" }
    );

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update holiday.";
    return apiError(message, 500);
  }
}
