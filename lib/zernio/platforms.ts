export type ZernioConnectPlatform =
  | "instagram"
  | "linkedin"
  | "facebook"
  | "twitter";

export const CONNECT_PLATFORMS: Array<{
  label: string;
  connectPlatform: ZernioConnectPlatform;
  accountKey: string;
}> = [
  { label: "Instagram", connectPlatform: "instagram", accountKey: "instagram" },
  { label: "LinkedIn", connectPlatform: "linkedin", accountKey: "linkedin" },
  { label: "Facebook", connectPlatform: "facebook", accountKey: "facebook" },
  { label: "X", connectPlatform: "twitter", accountKey: "x" },
];

export function toZernioConnectPlatform(
  platform: string
): ZernioConnectPlatform {
  const key = platform.trim().toLowerCase();
  if (key === "instagram") return "instagram";
  if (key === "linkedin") return "linkedin";
  if (key === "facebook") return "facebook";
  if (key === "x" || key === "twitter") return "twitter";
  throw new Error(`Unsupported connect platform: ${platform}`);
}

export function toAccountIdKey(platform: string): string {
  const key = platform.trim().toLowerCase();
  if (key === "twitter") return "x";
  return key;
}

export function normalizePostPlatformKey(platform: string): string {
  return platform.trim().toLowerCase();
}
