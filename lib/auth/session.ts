import { createAdminClient, createServerClient } from "@/lib/supabase/server";

import { getProfileForClient } from "./profile";
import type { SessionUser } from "./user";

export type { SessionUser } from "./user";

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const admin = createAdminClient();
  return getProfileForClient(admin, user.id, user.email);
}
