import { createAdminClient } from "@/lib/supabase/admin";

let cachedSenderEmail: string | null = null;

const DEFAULT_SENDER_EMAIL = "donotreply@autopilot.com";

export async function getSenderEmail(): Promise<string> {
  if (cachedSenderEmail) {
    return cachedSenderEmail;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "sender_email")
    .single();

  cachedSenderEmail = data?.value ?? DEFAULT_SENDER_EMAIL;
  return cachedSenderEmail;
}

export async function getResendFromAddress(): Promise<string> {
  const senderEmail = await getSenderEmail();
  return `Autopilot <${senderEmail}>`;
}

export function clearSenderEmailCache(): void {
  cachedSenderEmail = null;
}

export async function getNotificationSettings(): Promise<{
  gate1_email: boolean;
  gate2_email: boolean;
  monthly_report: boolean;
  weekly_summary: boolean;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "notification_settings")
    .single();

  const defaults = {
    gate1_email: true,
    gate2_email: true,
    monthly_report: true,
    weekly_summary: false,
  };

  if (!data?.value) {
    return defaults;
  }

  try {
    return { ...defaults, ...JSON.parse(data.value) };
  } catch {
    return defaults;
  }
}
