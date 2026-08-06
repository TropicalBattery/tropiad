import type { AppRole } from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  companyId: string | null;
  companySlug: string | null;
  companyName: string | null;
};

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function getUserInitials(user: SessionUser): string {
  return getInitials(user.fullName, user.email);
}

export function getUserRoleLabel(user: SessionUser): string {
  if (user.role === "marketing") {
    return "Marketing";
  }

  if (user.role === "approver") {
    return "Approver";
  }

  return user.email;
}
