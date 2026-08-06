import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/server";

const ACCEPTED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_SIZE_MB = 5;

type RouteContext = {
  params: { companyId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const { companyId } = context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Invalid form data", 400);
  }

  const file = formData.get("file");
  const slug = formData.get("slug");

  if (!(file instanceof File)) {
    return apiError("Logo file is required", 400);
  }

  if (typeof slug !== "string" || slug.length === 0) {
    return apiError("Company slug is required", 400);
  }

  if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
    return apiError("Please upload a PNG, JPG, WEBP, or SVG file.", 400);
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return apiError(`Logo must be under ${MAX_SIZE_MB}MB.`, 400);
  }

  const admin = createAdminClient();
  const extension = file.name.split(".").pop() ?? "png";
  const path = `${slug}/logo.${extension}`;

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
    .eq("company_id", companyId)
    .select("logo_url")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ logo_url: data.logo_url ?? publicUrl });
}
