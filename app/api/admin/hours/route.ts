import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessHourRow } from "@/lib/validations/catalogue";
import { businessHoursPatchSchema } from "@/lib/validations/catalogue";

type HoursClient = ReturnType<typeof createAdminClient> & {
  from(table: "business_hours"): {
    select(columns?: string): {
      eq(
        column: string,
        value: string
      ): {
        order(
          column: string,
          options?: { ascending?: boolean }
        ): Promise<{ data: BusinessHourRow[] | null; error: Error | null }>;
      };
    };
    upsert(
      values: Record<string, unknown>[],
      options?: { onConflict?: string }
    ): {
      select(columns?: string): Promise<{
        data: BusinessHourRow[] | null;
        error: Error | null;
      }>;
    };
  };
};

function getHoursClient(): HoursClient {
  return createAdminClient() as HoursClient;
}

function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.length === 5 ? `${value}:00` : value;
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const companyId = new URL(request.url).searchParams.get("company_id");

  if (!companyId) {
    return apiError("company_id is required.", 400);
  }

  const admin = getHoursClient();
  const { data, error } = await admin
    .from("business_hours")
    .select("*")
    .eq("company_id", companyId)
    .order("day_of_week", { ascending: true });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data ?? []);
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = businessHoursPatchSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request body";
    return apiError(message, 400);
  }

  const now = new Date().toISOString();
  const rows = parsed.data.hours.map((hour) => ({
    company_id: parsed.data.company_id,
    day_of_week: hour.day_of_week,
    open_time: hour.closed ? null : normalizeTimeValue(hour.open_time ?? null),
    close_time: hour.closed
      ? null
      : normalizeTimeValue(hour.close_time ?? null),
    closed: hour.closed,
    updated_at: now,
  }));

  const admin = getHoursClient();
  const { data, error } = await admin
    .from("business_hours")
    .upsert(rows, { onConflict: "company_id,day_of_week" })
    .select("*");

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data ?? []);
}
