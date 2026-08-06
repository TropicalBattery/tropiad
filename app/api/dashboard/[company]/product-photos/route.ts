import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { assertClientCompanyAccess } from "@/lib/data/client-settings-access";
import { createAdminClient } from "@/lib/supabase/server";
import type { ProductPhoto } from "@/lib/supabase/types";

const ACCEPTED_PHOTO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_SIZE_MB = 10;

const patchProductPhotoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

type RouteContext = {
  params: { company: string };
};

async function getCompanyFromContext(context: RouteContext) {
  return assertClientCompanyAccess(context.params.company);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const company = await getCompanyFromContext(context);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("product_photos")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess((data ?? []) as ProductPhoto[]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch product photos.";
    return apiError(message, 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const company = await getCompanyFromContext(context);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError("Invalid form data", 400);
    }

    const file = formData.get("file");
    const name = String(formData.get("name") ?? "").trim();
    const descriptionRaw = formData.get("description");
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim()
        ? descriptionRaw.trim()
        : null;

    if (!(file instanceof File)) {
      return apiError("Photo file is required", 400);
    }

    if (!name) {
      return apiError("Product name is required", 400);
    }

    if (!ACCEPTED_PHOTO_TYPES.has(file.type)) {
      return apiError("Please upload a PNG, JPG, or WEBP file.", 400);
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return apiError(`Photo must be under ${MAX_SIZE_MB}MB.`, 400);
    }

    const admin = createAdminClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${company.slug}/products/${Date.now()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("brand-assets")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      return apiError(uploadError.message, 500);
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("brand-assets").getPublicUrl(path);

    const { data, error } = await admin
      .from("product_photos")
      .insert({
        company_id: company.id,
        name,
        description,
        photo_url: publicUrl,
        active: true,
      })
      .select("*")
      .single();

    if (error || !data) {
      return apiError(error?.message ?? "Failed to create product photo.", 500);
    }

    return apiSuccess(data as ProductPhoto, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create product photo.";
    return apiError(message, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const company = await getCompanyFromContext(context);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const parsed = patchProductPhotoSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues.map((issue) => issue.message).join(". ") ||
        "Invalid request body";
      return apiError(message, 400);
    }

    const admin = createAdminClient();
    const { data: existing, error: fetchError } = await admin
      .from("product_photos")
      .select("id, company_id")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (fetchError) {
      return apiError(fetchError.message, 500);
    }

    if (!existing || existing.company_id !== company.id) {
      return apiError("Product photo not found.", 404);
    }

    const updates: {
      name?: string;
      description?: string | null;
      active?: boolean;
    } = {};
    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name.trim();
    }
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
    }
    if (parsed.data.active !== undefined) {
      updates.active = parsed.data.active;
    }

    if (Object.keys(updates).length === 0) {
      return apiError("No fields to update.", 400);
    }

    const { data, error } = await admin
      .from("product_photos")
      .update(updates)
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error || !data) {
      return apiError(error?.message ?? "Failed to update product photo.", 500);
    }

    return apiSuccess(data as ProductPhoto);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update product photo.";
    return apiError(message, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const company = await getCompanyFromContext(context);
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return apiError("id query parameter is required.", 400);
    }

    const admin = createAdminClient();
    const { data: existing, error: fetchError } = await admin
      .from("product_photos")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return apiError(fetchError.message, 500);
    }

    if (!existing || existing.company_id !== company.id) {
      return apiError("Product photo not found.", 404);
    }

    const { error } = await admin.from("product_photos").delete().eq("id", id);

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess({ id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete product photo.";
    return apiError(message, 500);
  }
}
