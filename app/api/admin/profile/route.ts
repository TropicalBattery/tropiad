import { requireAdminSession } from "@/lib/admin/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validations/admin-users";

export async function PATCH(request: Request) {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request body";
    return apiError(message, 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .update({ full_name: parsed.data.fullName })
    .eq("id", sessionUser.id)
    .select("full_name")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ fullName: data.full_name });
}

export async function POST() {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const admin = createAdminClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await admin.auth.resetPasswordForEmail(sessionUser.email, {
    redirectTo: `${siteUrl}/login`,
  });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
