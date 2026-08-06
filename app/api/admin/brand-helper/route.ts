import { z } from "zod";

import {
  generateBrandHelperOutput,
  type BrandHelperOutput,
} from "@/lib/agents/brand-helper";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";

const brandHelperRequestSchema = z.object({
  companyId: z.string().uuid().optional(),
  whatYouDo: z.string().min(10, "What you do must be at least 10 characters."),
  idealCustomer: z
    .string()
    .min(10, "Ideal customer must be at least 10 characters."),
  whatMakesYouDifferent: z
    .string()
    .min(10, "What makes you different must be at least 10 characters."),
  personality: z
    .string()
    .min(10, "Brand personality must be at least 10 characters."),
});

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const parsed = brandHelperRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid brand helper payload.";
      return apiError(message, 400);
    }

    const { companyId, ...input } = parsed.data;

    const output: BrandHelperOutput = await generateBrandHelperOutput(input, {
      companyId,
    });

    return apiSuccess(output);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate brand helper output.";
    return apiError(message, 500);
  }
}
