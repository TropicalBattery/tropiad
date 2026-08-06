import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PLATFORM_TIMES = ["09:00", "12:00", "18:00"];

function getPlatformTimes(
  preferredTimes: Record<string, string | string[]> | null,
  platform: string
): string[] {
  if (!preferredTimes) {
    return DEFAULT_PLATFORM_TIMES;
  }

  const entry = Object.entries(preferredTimes).find(
    ([key]) => key.toLowerCase() === platform.toLowerCase()
  )?.[1];

  if (!entry) {
    return DEFAULT_PLATFORM_TIMES;
  }

  if (Array.isArray(entry)) {
    return entry.length > 0 ? entry : DEFAULT_PLATFORM_TIMES;
  }

  return [entry];
}

export async function calculateScheduledAt(
  companyId: string,
  platform: string
): Promise<string> {
  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("brand_configs")
    .select("preferred_times, timezone, post_frequency")
    .eq("company_id", companyId)
    .single();

  const preferredTimes = config?.preferred_times as Record<
    string,
    string | string[]
  > | null;
  const platformTimes = getPlatformTimes(preferredTimes, platform);

  const { data: scheduledPosts } = await supabase
    .from("posts")
    .select("scheduled_at")
    .eq("company_id", companyId)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", new Date().toISOString());

  const takenSlots = new Set(
    scheduledPosts?.map((post) => {
      const slot = new Date(post.scheduled_at as string);
      slot.setMinutes(0, 0, 0);
      return slot.toISOString();
    }) ?? []
  );

  for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
    for (const time of platformTimes) {
      const [hour, minute] = time.split(":").map(Number);
      const candidate = new Date();
      candidate.setDate(candidate.getDate() + dayOffset);
      candidate.setHours(hour, minute ?? 0, 0, 0);

      if (candidate <= new Date()) {
        continue;
      }

      const slotKey = new Date(candidate);
      slotKey.setMinutes(0, 0, 0);

      if (!takenSlots.has(slotKey.toISOString())) {
        return candidate.toISOString();
      }
    }
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 2);
  fallback.setHours(9, 0, 0, 0);
  return fallback.toISOString();
}
