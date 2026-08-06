import { HOLIDAY_SEED } from "@/lib/data/holidays";
import { createAdminClient } from "@/lib/supabase/admin";

export async function seedHolidaysTable(): Promise<{
  count: number;
  error: string | null;
}> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("holidays").upsert(
    HOLIDAY_SEED.map((holiday) => ({
      name: holiday.name,
      description: holiday.description,
      month: holiday.month,
      day: holiday.day ?? null,
      week_of_month: holiday.week_of_month ?? null,
      day_of_week: holiday.day_of_week ?? null,
      category: holiday.category,
      country_codes: holiday.country_codes,
      active: true,
    })),
    { onConflict: "name" }
  );

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: HOLIDAY_SEED.length, error: null };
}
