export type UserStatus = "active" | "invited";

export type AdminUserRecord = {
  id: string;
  email: string;
  role: "admin" | "client";
  full_name: string | null;
  company_id: string | null;
  created_at: string;
  company_name: string | null;
  company_slug: string | null;
  status: UserStatus;
};

export type CompanyOption = {
  id: string;
  name: string;
  slug: string;
};

export type SystemStatusItem = {
  service: string;
  configured: boolean;
  maskedKey: string | null;
  envVar: string;
};

export type CreateUserResponse = {
  user: AdminUserRecord;
  tempPassword?: string;
};
