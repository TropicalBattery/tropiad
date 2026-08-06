import {
  getSingleCompanyId,
  getSingleCompanySlug,
} from "@/lib/config/single-company";

/** Inventory `public.user_roles` roles allowed into autopilot. */
export type AppRole = "marketing" | "approver";

const ALLOWED_ROLES = new Set<AppRole>(["marketing", "approver"]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedAppRole(
  role: string | null | undefined
): role is AppRole {
  return role === "marketing" || role === "approver";
}

/** Operator tools (/admin APIs) — both allowed roles may access in single-client mode. */
export function canAccessOperatorTools(
  role: string | null | undefined
): boolean {
  return isAllowedAppRole(role);
}

export function getPinnedCompanyBinding(): {
  companyId: string;
  companySlug: string;
  companyName: string;
} {
  return {
    companyId: getSingleCompanyId(),
    companySlug: getSingleCompanySlug(),
    companyName: "Tropical Battery",
  };
}

export function parseAppRole(value: string | null | undefined): AppRole | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (ALLOWED_ROLES.has(normalized as AppRole)) {
    return normalized as AppRole;
  }
  return null;
}
