import { createAdminClient } from "@/lib/supabase/server";
import type { Holiday } from "@/lib/supabase/types";

export type MergedCompanyHoliday = Holiday & {
  enabled: boolean;
  custom_name: string | null;
  company_holiday_id: string | null;
};

export async function getMergedCompanyHolidays(
  companyId: string
): Promise<MergedCompanyHoliday[]> {
  const admin = createAdminClient();

  const [{ data: allHolidays }, { data: companyHolidays }] = await Promise.all([
    admin
      .from("holidays")
      .select("*")
      .eq("active", true)
      .order("month")
      .order("day"),
    admin.from("company_holidays").select("*").eq("company_id", companyId),
  ]);

  const overrideMap = new Map(
    companyHolidays?.map((entry) => [entry.holiday_id, entry]) ?? []
  );

  return (allHolidays ?? []).map((holiday) => {
    const override = overrideMap.get(holiday.id);
    return {
      ...holiday,
      enabled: override ? override.enabled : true,
      custom_name: override?.custom_name ?? null,
      company_holiday_id: override?.id ?? null,
    };
  });
}
