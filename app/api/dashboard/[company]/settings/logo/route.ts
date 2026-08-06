import { apiError, apiSuccess } from "@/lib/api/response";
import { assertClientCompanyAccess } from "@/lib/data/client-settings-access";
import { createAdminClient } from "@/lib/supabase/server";

const ACCEPTED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_SIZE_MB = 5;

type RouteContext = {
  params: { company: string };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const company = await assertClientCompanyAccess(context.params.company);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError("Invalid form data", 400);
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("Logo file is required", 400);
    }

    if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
      return apiError("Please upload a PNG, JPG, WEBP, or SVG file.", 400);
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return apiError(`Logo must be under ${MAX_SIZE_MB}MB.`, 400);
    }

    const admin = createAdminClient();
    const extension = file.name.split(".").pop() ?? "png";
    const path = `${company.slug}/logo.${extension}`;

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
      .from("brand_configs")
      .update({
        logo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", company.id)
      .select("logo_url")
      .single();

    if (error) {
      return apiError(error.message, 500);
    }

    return apiSuccess({ logo_url: data.logo_url ?? publicUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload logo.";
    return apiError(message, 500);
  }
}
