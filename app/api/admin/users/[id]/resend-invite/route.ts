import { requireAdminSession } from "@/lib/admin/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/server";

type RouteContext = {
  params: { id: string };
};

export async function POST(_request: Request, context: RouteContext) {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const { id } = context.params;
  const admin = createAdminClient();

  const { data: user, error: userError } = await admin
    .from("users")
    .select("email")
    .eq("id", id)
    .single();

  if (userError || !user) {
    return apiError(userError?.message ?? "User not found.", 404);
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(user.email);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
