import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogueItemRow } from "@/lib/validations/catalogue";
import { catalogueItemCreateSchema } from "@/lib/validations/catalogue";

type CatalogueClient = ReturnType<typeof createAdminClient> & {
  from(table: "business_catalogue"): {
    select(columns?: string): {
      eq(
        column: string,
        value: string
      ): {
        order(
          column: string,
          options?: { ascending?: boolean }
        ): Promise<{ data: CatalogueItemRow[] | null; error: Error | null }>;
      };
    };
    insert(
      values: Record<string, unknown>
    ): {
      select(columns?: string): {
        single(): Promise<{
          data: CatalogueItemRow | null;
          error: Error | null;
        }>;
      };
    };
  };
};

function getCatalogueClient(): CatalogueClient {
  return createAdminClient() as CatalogueClient;
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

  const admin = getCatalogueClient();
  const { data, error } = await admin
    .from("business_catalogue")
    .select("*")
    .eq("company_id", companyId)
    .order("category", { ascending: true });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data ?? []);
}

export async function POST(request: Request) {
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

  const parsed = catalogueItemCreateSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request body";
    return apiError(message, 400);
  }

  const admin = getCatalogueClient();
  const { data, error } = await admin
    .from("business_catalogue")
    .insert({
      company_id: parsed.data.company_id,
      item_name: parsed.data.item_name.trim(),
      category: parsed.data.category?.trim() || null,
      price_jmd: parsed.data.price_jmd ?? null,
      description: parsed.data.description?.trim() || null,
      available: parsed.data.available ?? true,
      seasonal: parsed.data.seasonal ?? false,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    return apiError(error?.message ?? "Failed to create catalogue item.", 500);
  }

  return apiSuccess(data, 201);
}
