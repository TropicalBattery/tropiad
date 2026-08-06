import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { cancelQueuedSelection } from "@/lib/queries/overstock";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return apiError("Selection id is required.", 400);
    }

    await cancelQueuedSelection(id);
    return apiSuccess({ cancelled: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel selection.";
    return apiError(message, 500);
  }
}
