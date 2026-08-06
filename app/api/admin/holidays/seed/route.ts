import { apiError, apiSuccess } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin/require-admin";
import { seedHolidaysTable } from "@/lib/data/seed-holidays";

export async function POST() {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const { count, error } = await seedHolidaysTable();

  if (error) {
    return apiError(error, 500);
  }

  return apiSuccess({ count, message: `Seeded ${count} holidays` });
}
