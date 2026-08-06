import { requireAdminSession, maskApiKey } from "@/lib/admin/require-admin";
import type { SystemStatusItem } from "@/lib/admin/settings-types";
import { apiError, apiSuccess } from "@/lib/api/response";

const SERVICES: Array<{
  service: string;
  envVar: string;
}> = [
  { service: "Anthropic Claude API", envVar: "ANTHROPIC_API_KEY" },
  { service: "Zernio", envVar: "ZERNIO_API_KEY" },
  { service: "Replicate (Flux)", envVar: "REPLICATE_API_KEY" },
  { service: "Google Gemini (Veo)", envVar: "GOOGLE_AI_API_KEY" },
  { service: "Resend", envVar: "RESEND_API_KEY" },
];

export async function GET() {
  const sessionUser = await requireAdminSession();
  if (!sessionUser) {
    return apiError("Unauthorized", 401);
  }

  const statuses: SystemStatusItem[] = SERVICES.map(({ service, envVar }) => {
    const value = process.env[envVar];
    const configured = Boolean(value?.trim());

    return {
      service,
      envVar,
      configured,
      maskedKey: maskApiKey(value),
    };
  });

  return apiSuccess(statuses);
}
