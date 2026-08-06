import { requireAdminSession } from "@/lib/admin/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { clearSenderEmailCache } from "@/lib/email/config";
import { createAdminClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value");

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data ?? []);
}

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

  const key =
    body && typeof body === "object" && "key" in body
      ? (body as { key?: unknown }).key
      : undefined;
  const value =
    body && typeof body === "object" && "value" in body
      ? (body as { value?: unknown }).value
      : undefined;

  if (typeof key !== "string" || !key.trim()) {
    return apiError("Setting key is required.", 400);
  }

  if (typeof value !== "string" || !value.trim()) {
    return apiError("Setting value is required.", 400);
  }

  const trimmedValue = value.trim();

  if (key === "sender_email" && !EMAIL_PATTERN.test(trimmedValue)) {
    return apiError("Please enter a valid email address.", 400);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("platform_settings").upsert(
    {
      key,
      value: trimmedValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    return apiError(error.message, 500);
  }

  if (key === "sender_email") {
    clearSenderEmailCache();
  }

  return apiSuccess({ success: true });
}
