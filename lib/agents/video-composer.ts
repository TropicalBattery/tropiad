// Server-only: do not import this module into client components.
//
// Requires env: CREATOMATE_API_KEY, CREATOMATE_TEMPLATE_ID
// Requires Supabase storage bucket: post-media (public read recommended)

import { createAdminClient } from "@/lib/supabase/admin";

const CREATOMATE_API_URL = "https://api.creatomate.com/v2";
const POST_MEDIA_BUCKET = "post-media";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

type ComposeVideoInput = {
  videoUrl: string;
  postId: string;
  companyId: string;
  caption: string;
  platform: string;
};

type CreatomateRender = {
  id?: string;
  status?: string;
  url?: string;
  error_message?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/CREATOMATE_API_KEY=\S+/gi, "[redacted]")
    .slice(0, 500);
}

async function pollCreatomateRender(
  renderId: string,
  apiKey: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${CREATOMATE_API_URL}/renders/${renderId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Creatomate status check failed (${response.status}): ${body.slice(0, 200)}`
      );
    }

    const render = (await response.json()) as CreatomateRender;

    if (render.status === "succeeded" && render.url) {
      return render.url;
    }

    if (render.status === "failed") {
      throw new Error(
        render.error_message ?? "Creatomate render failed without details."
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Creatomate render timed out.");
}

async function persistBrandedVideo(
  sourceUrl: string,
  companyId: string,
  postId: string
): Promise<string> {
  const downloadResponse = await fetch(sourceUrl);
  if (!downloadResponse.ok) {
    throw new Error(
      `Creatomate download failed: provider returned status ${downloadResponse.status}.`
    );
  }

  const videoBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  if (videoBuffer.length === 0) {
    throw new Error("Creatomate download failed: downloaded file was empty.");
  }

  const admin = createAdminClient();
  const storagePath = `${companyId}/${postId}/branded-${Date.now()}.mp4`;

  const { error: uploadError } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .upload(storagePath, videoBuffer, {
      contentType: "video/mp4",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Branded video upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(POST_MEDIA_BUCKET).getPublicUrl(storagePath);

  if (!publicUrl) {
    throw new Error("Branded video upload failed: could not resolve public URL.");
  }

  return publicUrl;
}

export async function composeVideo(input: ComposeVideoInput): Promise<string> {
  const apiKey = process.env.CREATOMATE_API_KEY;
  const templateId = process.env.CREATOMATE_TEMPLATE_ID;

  if (!apiKey) {
    throw new Error("Missing CREATOMATE_API_KEY.");
  }

  if (!templateId) {
    throw new Error("Missing CREATOMATE_TEMPLATE_ID.");
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("name")
    .eq("id", input.companyId)
    .maybeSingle();

  const captionText = input.caption.trim();

  const response = await fetch(`${CREATOMATE_API_URL}/renders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      modifications: {
        "Video.source": input.videoUrl,
        "Text-1.text": captionText,
        "Text-2.text": company?.name ?? "",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Creatomate render request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as CreatomateRender | CreatomateRender[];
  const render = Array.isArray(payload) ? payload[0] : payload;

  if (!render?.id) {
    throw new Error("Creatomate render request failed: missing render ID.");
  }

  try {
    const outputUrl = await pollCreatomateRender(render.id, apiKey);
    return await persistBrandedVideo(outputUrl, input.companyId, input.postId);
  } catch (error) {
    throw new Error(`Creatomate compose failed: ${sanitizeErrorMessage(error)}`);
  }
}
