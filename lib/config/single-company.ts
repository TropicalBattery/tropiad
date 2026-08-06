/**
 * Single-client pin for Tropical Battery.
 * Multi-tenant company_id plumbing stays intact; this module is the
 * only place that decides "which company" in single-company mode.
 */

const FALLBACK_COMPANY_ID = "46b83ebf-dd3e-495a-a0ef-aed3d0155e0c";
const FALLBACK_COMPANY_SLUG = "tropical-battery";

export function getSingleCompanyId(): string {
  const fromEnv = process.env.SINGLE_COMPANY_ID?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_COMPANY_ID;
}

export function getSingleCompanySlug(): string {
  const fromEnv =
    process.env.SINGLE_COMPANY_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_SINGLE_COMPANY_SLUG?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_COMPANY_SLUG;
}

export function getSingleCompanyDashboardPath(): string {
  return `/dashboard/${getSingleCompanySlug()}`;
}

export function isSingleCompanySlug(slug: string): boolean {
  return slug.trim().toLowerCase() === getSingleCompanySlug().toLowerCase();
}
