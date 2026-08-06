import { requireAdminSession } from "@/lib/admin/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/server";

type RouteContext = {
  params: { id: string };
};

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const { id } = context.params;

  if (id === sessionUser.id) {
    return apiError("You cannot remove your own account.", 400);
  }

  const admin = createAdminClient();

  const { error: profileError } = await admin.from("users").delete().eq("id", id);
  if (profileError) {
    return apiError(profileError.message, 500);
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return apiError(authError.message, 500);
  }

  return apiSuccess({ success: true });
}
