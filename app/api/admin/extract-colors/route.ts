import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { apiError, apiSuccess } from "@/lib/api/response";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const requestSchema = z.object({
  logoUrl: z.string().url(),
});

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const hex = trimmed.slice(1);
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
  }

  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return `#${trimmed}`.toUpperCase();
  }

  return null;
}

const colorResponseSchema = z.object({
  primary_color: z.preprocess(
    normalizeHexColor,
    z.string().regex(HEX_COLOR, "Invalid primary color")
  ),
  secondary_color: z.preprocess(
    normalizeHexColor,
    z.string().regex(HEX_COLOR, "Invalid secondary color")
  ),
  accent_color: z.preprocess(
    normalizeHexColor,
    z.string().regex(HEX_COLOR, "Invalid accent color")
  ),
  color_notes: z.string(),
});

type ExtractedColors = z.infer<typeof colorResponseSchema>;

const COLOR_EXTRACTION_PROMPT = `Analyze this logo image and identify the brand color palette.

Return ONLY valid JSON in this exact format, no other text:
{
  "primary_color": "#XXXXXX",
  "secondary_color": "#XXXXXX", 
  "accent_color": "#XXXXXX",
  "color_notes": "brief description of the color usage"
}

Guidelines:
- primary_color should be the most dominant or brand-defining color in the logo (often used most prominently or in the main wordmark)
- secondary_color should be a complementary color also present in the logo
- accent_color should be a third distinct color from the logo, ideal for highlights or calls-to-action
- If the logo has multiple equally prominent colors (like a multi-color icon), choose the three most visually distinct and usable ones for a social media brand palette
- Return precise hex codes based on what you observe in the image
- Avoid pure black (#000000) and pure white (#FFFFFF) unless the logo genuinely has no other colors
- All three colors must be different from each other`;

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }

  return new Anthropic({ apiKey });
}

function parseJsonFromResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced?.[1]?.trim() ?? text.trim();
  return JSON.parse(payload);
}

function resolveMediaType(
  logoUrl: string,
  contentType: string | null
): "image/png" | "image/jpeg" | "image/webp" | null {
  if (contentType === "image/png") {
    return "image/png";
  }
  if (contentType === "image/jpeg") {
    return "image/jpeg";
  }
  if (contentType === "image/webp") {
    return "image/webp";
  }

  const pathname = new URL(logoUrl).pathname.toLowerCase();

  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

async function fetchLogoAsBase64(logoUrl: string) {
  let response: Response;

  try {
    response = await fetch(logoUrl);
  } catch {
    throw new Error("Failed to fetch logo image.");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch logo image (${response.status}).`);
  }

  const mediaType = resolveMediaType(
    logoUrl,
    response.headers.get("content-type")?.split(";")[0]?.trim() ?? null
  );

  if (!mediaType) {
    throw new Error("Unsupported logo format. Use PNG, JPG, or WEBP.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Logo image is empty.");
  }

  return {
    mediaType,
    data: buffer.toString("base64"),
  };
}

function getResponseText(content: Anthropic.Message["content"]): string {
  const textBlock = content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text response.");
  }

  return textBlock.text;
}

/** Hobby ceiling is 60s (legacy Hobby default is ~10s without this). */
export const maxDuration = 60;

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !canAccessOperatorTools(sessionUser.role)) {
    return apiError("Unauthorized", 401);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError("Missing ANTHROPIC_API_KEY.", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return apiError("A valid logoUrl is required.", 400);
  }

  const { logoUrl } = parsedRequest.data;

  let imagePayload: { mediaType: "image/png" | "image/jpeg" | "image/webp"; data: string };
  try {
    imagePayload = await fetchLogoAsBase64(logoUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch logo image.";
    return apiError(message, 400);
  }

  let anthropic: Anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Claude API is not configured.";
    return apiError(message, 500);
  }

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imagePayload.mediaType,
                data: imagePayload.data,
              },
            },
            {
              type: "text",
              text: COLOR_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to analyze logo with Claude.";
    return apiError(message, 502);
  }

  let parsedColors: ExtractedColors;
  try {
    const raw = parseJsonFromResponse(getResponseText(response.content));
    const validated = colorResponseSchema.safeParse(raw);
    if (!validated.success) {
      const message =
        validated.error.issues.map((issue) => issue.message).join(". ") ||
        "Claude returned an invalid color palette.";
      return apiError(message, 502);
    }
    parsedColors = validated.data;
  } catch {
    return apiError("Failed to parse Claude color response.", 502);
  }

  return apiSuccess(parsedColors);
}
