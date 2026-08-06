import type { User } from "@supabase/supabase-js";

import { requireAdminSession, generateTempPassword } from "@/lib/admin/require-admin";
import type { AdminUserRecord, UserStatus } from "@/lib/admin/settings-types";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/server";
import { createUserSchema } from "@/lib/validations/admin-users";

function getUserStatus(authUser: User | undefined): UserStatus {
  if (!authUser) {
    return "invited";
  }

  if (authUser.email_confirmed_at || authUser.last_sign_in_at) {
    return "active";
  }

  return "invited";
}

async function fetchAuthUsersById(admin: ReturnType<typeof createAdminClient>) {
  const authById = new Map<string, User>();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      authById.set(user.id, user);
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return authById;
}

export async function GET() {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const admin = createAdminClient();

  const [{ data: users, error: usersError }, authById] = await Promise.all([
    admin
      .from("users")
      .select("id, email, role, full_name, company_id, created_at, companies(name, slug)")
      .order("created_at", { ascending: false }),
    fetchAuthUsersById(admin).catch((error: Error) => {
      throw error;
    }),
  ]);

  if (usersError) {
    return apiError(usersError.message, 500);
  }

  const records: AdminUserRecord[] = (users ?? []).map((user) => {
    const company = Array.isArray(user.companies)
      ? user.companies[0]
      : user.companies;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      company_id: user.company_id,
      created_at: user.created_at,
      company_name: company?.name ?? null,
      company_slug: company?.slug ?? null,
      status: getUserStatus(authById.get(user.id)),
    };
  });

  return apiSuccess(records);
}

export async function POST(request: Request) {
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

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(". ") ||
      "Invalid request body";
    return apiError(message, 400);
  }

  const { fullName, email, role, companyId, sendInvite } = parsed.data;
  const admin = createAdminClient();
  const tempPassword = sendInvite ? undefined : generateTempPassword();

  let authUserId: string;

  if (sendInvite) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });

    if (error || !data.user) {
      return apiError(error?.message ?? "Failed to invite user.", 500);
    }

    authUserId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      return apiError(error?.message ?? "Failed to create user.", 500);
    }

    authUserId = data.user.id;
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .insert({
      id: authUserId,
      email,
      role,
      company_id: role === "client" ? companyId : null,
      full_name: fullName,
    })
    .select("id, email, role, full_name, company_id, created_at, companies(name, slug)")
    .single();

  if (profileError) {
    await admin.auth.admin.deleteUser(authUserId);
    return apiError(profileError.message, 500);
  }

  const company = Array.isArray(profile.companies)
    ? profile.companies[0]
    : profile.companies;

  const user: AdminUserRecord = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    full_name: profile.full_name,
    company_id: profile.company_id,
    created_at: profile.created_at,
    company_name: company?.name ?? null,
    company_slug: company?.slug ?? null,
    status: sendInvite ? "invited" : "active",
  };

  return apiSuccess({
    user,
    tempPassword,
  });
}
