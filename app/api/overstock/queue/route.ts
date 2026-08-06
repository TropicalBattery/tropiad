import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  getQueuedSelection,
  queueOverstockSelection,
} from "@/lib/queries/overstock";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as {
      skus?: unknown;
      postCount?: unknown;
      email?: unknown;
    };

    const skus = Array.isArray(body.skus)
      ? body.skus.filter((sku): sku is string => typeof sku === "string" && sku.trim().length > 0)
      : [];
    const postCount =
      typeof body.postCount === "number"
        ? body.postCount
        : Number(body.postCount);
    const email =
      typeof body.email === "string"
        ? body.email
        : sessionUser.email ?? null;

    if (skus.length === 0) {
      return apiError("At least one SKU is required.", 400);
    }

    await queueOverstockSelection(skus, postCount, email);
    const queued = await getQueuedSelection();

    if (!queued) {
      return apiError("Selection queued but could not be reloaded.", 500);
    }

    return apiSuccess(queued, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to queue selection.";
    return apiError(message, 500);
  }
}
