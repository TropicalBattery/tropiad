import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogueItemRow } from "@/lib/validations/catalogue";
import { catalogueItemUpdateSchema } from "@/lib/validations/catalogue";

type RouteContext = {
  params: { id: string };
};

type CatalogueClient = ReturnType<typeof createAdminClient> & {
  from(table: "business_catalogue"): {
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string
      ): {
        select(columns?: string): {
          single(): Promise<{
            data: CatalogueItemRow | null;
            error: Error | null;
          }>;
        };
      };
    };
    delete(): {
      eq(
        column: string,
        value: string
      ): Promise<{ error: Error | null }>;
    };
  };
};

function getCatalogueClient(): CatalogueClient {
  return createAdminClient() as CatalogueClient;
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = catalogueItemUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request body";
    return apiError(message, 400);
  }

  const admin = getCatalogueClient();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.item_name !== undefined) {
    updatePayload.item_name = parsed.data.item_name.trim();
  }
  if (parsed.data.category !== undefined) {
    updatePayload.category = parsed.data.category?.trim() || null;
  }
  if (parsed.data.price_jmd !== undefined) {
    updatePayload.price_jmd = parsed.data.price_jmd;
  }
  if (parsed.data.description !== undefined) {
    updatePayload.description = parsed.data.description?.trim() || null;
  }
  if (parsed.data.available !== undefined) {
    updatePayload.available = parsed.data.available;
  }
  if (parsed.data.seasonal !== undefined) {
    updatePayload.seasonal = parsed.data.seasonal;
  }

  const { data, error } = await admin
    .from("business_catalogue")
    .update(updatePayload)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return apiError(error?.message ?? "Failed to update catalogue item.", 500);
  }

  return apiSuccess(data);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const admin = getCatalogueClient();
  const { error } = await admin
    .from("business_catalogue")
    .delete()
    .eq("id", params.id);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ id: params.id });
}
