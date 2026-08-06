import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import {
  readSectionsConfirmed,
  updateBrandConfigRow,
} from "@/lib/onboarding/brand-config-persistence";
import { mergeSectionsConfirmed } from "@/lib/onboarding/sections-confirmed";
import {
  createClientSchema,
  launchClientSchema,
  setupCompanyDetailsSchema,
} from "@/lib/validations/onboard";

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

  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid company details.";
    return apiError(message, 400);
  }

  const admin = createAdminClient();
  const data = parsed.data;

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: data.companyName,
      slug: data.slug,
      owner_email: data.ownerEmail,
      // Migration: alter table companies add column if not exists status text default 'setup';
      status: "setup",
      plan: "standard",
    })
    .select("id, slug")
    .single();

  if (companyError || !company) {
    if (companyError?.code === "23505") {
      return apiError("A company with this slug already exists.", 409);
    }
    return apiError(companyError?.message ?? "Failed to create company.", 500);
  }

  const { error: brandError } = await admin.from("brand_configs").insert({
    company_id: company.id,
    industry: [],
    target_audience: "",
    unique_selling_point: "",
    tone: "Professional",
    brand_voice_doc: null,
    topics_to_cover: [],
    topics_to_avoid: [],
    competitor_handles: [],
    primary_color: "#0B1C3D",
    secondary_color: "#FFFFFF",
    accent_color: "#0D9488",
    logo_url: null,
    image_style: "Lifestyle",
    active_platforms: [],
    post_frequency: 5,
    preferred_times: {},
    timezone: "America/Jamaica",
    promotional_pct: 20,
    educational_pct: 50,
    engagement_pct: 30,
    hashtag_sets: {},
    visual_references: [],
    zernio_account_ids: {},
    visual_audience_profile: { demographic: "local", local_pct: 100 },
  });

  if (brandError) {
    await admin.from("companies").delete().eq("id", company.id);
    return apiError(brandError.message, 500);
  }

  return apiSuccess({
    id: company.id,
    slug: company.slug,
  });
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return apiError("companyId is required.", 400);
  }

  const admin = createAdminClient();
  const [{ data: company, error: companyError }, { data: brand, error: brandError }] =
    await Promise.all([
      admin.from("companies").select("*").eq("id", companyId).maybeSingle(),
      admin
        .from("brand_configs")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle(),
    ]);

  if (companyError) {
    return apiError(companyError.message, 500);
  }

  if (brandError) {
    return apiError(brandError.message, 500);
  }

  if (!company) {
    return apiError("Company not found.", 404);
  }

  return apiSuccess({ company, brand });
}

export async function PATCH(request: Request) {
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

  const launchParsed = launchClientSchema.safeParse(body);
  if (launchParsed.success) {
    const admin = createAdminClient();
    const { data: company, error } = await admin
      .from("companies")
      .update({ status: "active" })
      .eq("id", launchParsed.data.companyId)
      .select("id, slug, status")
      .single();

    if (error || !company) {
      return apiError(error?.message ?? "Failed to launch client.", 500);
    }

    return apiSuccess({ company });
  }

  const detailsParsed = setupCompanyDetailsSchema
    .extend({ companyId: z.string().uuid() })
    .safeParse(body);

  if (!detailsParsed.success) {
    const message =
      detailsParsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request.";
    return apiError(message, 400);
  }

  const { companyId, companyName, ownerEmail, ...brandFields } =
    detailsParsed.data;
  const admin = createAdminClient();

  let existingSectionsConfirmed: Json | undefined;

  try {
    existingSectionsConfirmed = await readSectionsConfirmed(admin, companyId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load brand config.";
    return apiError(message, 500);
  }

  const brandUpdate: Record<string, unknown> = {
    industry: brandFields.industry,
    target_audience: brandFields.targetAudience,
    unique_selling_point: brandFields.uniqueSellingPoint,
    visual_audience_profile: brandFields.visualAudienceProfile,
  };

  if (existingSectionsConfirmed !== undefined) {
    brandUpdate.sections_confirmed = mergeSectionsConfirmed(
      existingSectionsConfirmed,
      "companyDetails"
    );
  }

  const [{ error: companyError }, { error: brandError }] = await Promise.all([
    admin
      .from("companies")
      .update({
        name: companyName,
        owner_email: ownerEmail,
      })
      .eq("id", companyId),
    updateBrandConfigRow(admin, companyId, brandUpdate).then((result) => ({
      error: result.error,
    })),
  ]);

  if (companyError) {
    return apiError(companyError.message, 500);
  }

  if (brandError) {
    return apiError(brandError.message, 500);
  }

  const [{ data: company }, { data: brand }] = await Promise.all([
    admin.from("companies").select("*").eq("id", companyId).single(),
    admin.from("brand_configs").select("*").eq("company_id", companyId).single(),
  ]);

  return apiSuccess({ company, brand });
}
