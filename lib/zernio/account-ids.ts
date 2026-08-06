import type { Json } from "@/lib/supabase/types";
import { toAccountIdKey } from "@/lib/zernio/platforms";
import type { ZernioAccountSummary } from "@/lib/zernio/connect";

export type ZernioAccountIds = Record<string, string>;

export function parseZernioAccountIds(value: Json | null | undefined): ZernioAccountIds {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  return Object.fromEntries(entries);
}

export function buildAccountIdsFromAccounts(
  accounts: ZernioAccountSummary[]
): ZernioAccountIds {
  const result: ZernioAccountIds = {};

  for (const account of accounts) {
    const key = toAccountIdKey(account.platform);
    if (account.accountId.trim()) {
      result[key] = account.accountId;
    }
  }

  return result;
}

export function resolveAccountIdForPlatform(
  accountIds: ZernioAccountIds,
  platform: string
): string | null {
  const key = platform.trim().toLowerCase();
  const aliases =
    key === "x"
      ? ["x", "twitter"]
      : key === "twitter"
        ? ["twitter", "x"]
        : [key];

  for (const alias of aliases) {
    const accountId = accountIds[alias];
    if (accountId && accountId.trim()) {
      return accountId;
    }
  }

  return null;
}
