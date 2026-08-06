// Server-only: do not import this module into client components.

import { getZernioClient } from "@/lib/zernio/client";
import type { ZernioConnectPlatform } from "@/lib/zernio/platforms";

export type ZernioAccountSummary = {
  accountId: string;
  platform: string;
  username: string;
};

export async function getZernioConnectUrl(params: {
  platform: ZernioConnectPlatform;
  profileId: string;
  redirectUrl: string;
}): Promise<{ authUrl: string }> {
  const zernio = getZernioClient();

  // @zernio/node uses path.platform and query.profileId/redirect_url (not flat params).
  const { data, error } = await zernio.connect.getConnectUrl({
    path: { platform: params.platform },
    query: {
      profileId: params.profileId,
      redirect_url: params.redirectUrl,
    },
  });

  if (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof error.error === "string"
        ? error.error
        : "Failed to get Zernio connect URL.";
    throw new Error(message);
  }

  if (!data?.authUrl) {
    throw new Error("Zernio did not return an auth URL.");
  }

  return { authUrl: data.authUrl };
}

export async function listZernioAccounts(
  profileId?: string
): Promise<ZernioAccountSummary[]> {
  const zernio = getZernioClient();

  const { data, error } = await zernio.accounts.listAccounts({
    query: profileId ? { profileId } : undefined,
  });

  if (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof error.error === "string"
        ? error.error
        : "Failed to list Zernio accounts.";
    throw new Error(message);
  }

  return (data?.accounts ?? []).map(
    (account: {
      _id: string;
      platform: string;
      username?: string;
      displayName?: string;
    }) => ({
      accountId: account._id,
      platform: account.platform,
      username: account.username ?? account.displayName ?? "",
    })
  );
}
