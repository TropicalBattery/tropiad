import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getZernioConnectUrl } from "@/lib/zernio/connect";
import {
  ensureZernioProfile,
  isZernioProfileAccessError,
} from "@/lib/zernio/profile";

const requestSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string().min(1),
  platform: z.enum(["instagram", "linkedin", "facebook", "twitter"]),
});

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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid connect request.", 400);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return apiError("Missing NEXT_PUBLIC_APP_URL.", 500);
  }

  try {
    let profileId = await ensureZernioProfile(
      parsed.data.companyId,
      parsed.data.companyName
    );

    const redirectUrl = `${appUrl.replace(/\/$/, "")}/api/admin/zernio/callback?companyId=${parsed.data.companyId}`;

    try {
      const { authUrl } = await getZernioConnectUrl({
        platform: parsed.data.platform,
        profileId,
        redirectUrl,
      });
      return apiSuccess({ authUrl });
    } catch (connectError) {
      // Stale zernio_profile_id in brand_configs (deleted/inaccessible on Zernio).
      if (!isZernioProfileAccessError(connectError)) {
        throw connectError;
      }

      profileId = await ensureZernioProfile(
        parsed.data.companyId,
        parsed.data.companyName,
        { recreate: true }
      );

      const { authUrl } = await getZernioConnectUrl({
        platform: parsed.data.platform,
        profileId,
        redirectUrl,
      });
      return apiSuccess({ authUrl });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create connect URL.";
    return apiError(message, 500);
  }
}
