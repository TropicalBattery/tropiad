// Server-only: do not import this module into client components.
//
// Expected posts table columns (add via migration before running):
// -- visual_prompt: text
// -- media_provider: text
// -- media_generation_attempts: integer default 0
// -- video_operation_id: text
// -- (image_url, video_url, pipeline_stage, error_message already exist)
//
// Requires Supabase storage bucket: post-media (public read recommended)

import Replicate from "replicate";

import {
  estimateFluxCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";
import type { MediaProvider, ProduceVisualParams } from "@/lib/agents/types";
import {
  checkVideoOperation,
  generateVideoFromPrompt,
} from "@/lib/agents/video";
import { writeVisualPrompt, writeVideoPrompt } from "@/lib/agents/visual-prompt";
import { checkRunGate2Notification } from "@/lib/email/templates";
import { parseVisualAudienceProfile } from "@/lib/validations/visual-audience";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandConfig } from "@/lib/supabase/types";
import { composeVideo } from "@/lib/agents/video-composer";

const FLUX_SCHNELL = "black-forest-labs/flux-schnell";
const FLUX_KONTEXT = "black-forest-labs/flux-kontext-pro";
const POST_MEDIA_BUCKET = "post-media";

/**
 * Stay under Hobby maxDuration=60 so we return a clean timeout instead of a
 * Vercel kill. On Pro, maxDuration can go to 300 and this wait can be raised.
 */
const IMAGE_POLL_INTERVAL_MS = 2000;
const IMAGE_POLL_MAX_WAIT_MS = 50 * 1000;

type GenerateImageParams = {
  prompt: string;
  companyId: string;
  postId: string;
  runId?: string | null;
  featuredProductUrl?: string;
};

type FileOutputLike = {
  url?: () => URL | string;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
};

function logStep(postId: string, step: string): void {
  console.log(`[produceVisual] ${postId} - ${step}`);
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const withoutSecrets = raw
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/r8_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/REPLICATE_API_KEY=\S+/gi, "[redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/GOOGLE_AI_API_KEY=\S+/gi, "[redacted]");
  return withoutSecrets.slice(0, 500);
}

function describeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value);
  }
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function readStreamToBuffer(
  stream: AsyncIterable<Uint8Array>
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new Error("Image download failed: provider stream was empty.");
  }

  return Buffer.concat(chunks);
}

async function downloadImageBuffer(sourceUrl: string): Promise<Buffer> {
  let imageResponse: Response;

  try {
    imageResponse = await fetch(sourceUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Network request failed";
    throw new Error(`Image download failed: ${message}`);
  }

  if (!imageResponse.ok) {
    throw new Error(
      `Image download failed: provider returned status ${imageResponse.status}.`
    );
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  if (imageBuffer.byteLength === 0) {
    throw new Error("Image download failed: downloaded file was empty.");
  }

  return Buffer.from(imageBuffer);
}

function isJpegBuffer(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

async function convertImageToJpeg(buffer: Buffer): Promise<Buffer> {
  // Replicate is asked for output_format jpg — skip native sharp when already JPEG
  // so Vercel approve/production does not require libvips for the happy path.
  if (isJpegBuffer(buffer)) {
    return buffer;
  }

  const { default: sharp } = await import("sharp");
  return sharp(buffer).jpeg({ quality: 90 }).toBuffer();
}

async function resolveProviderImage(
  output: unknown
): Promise<{ url?: string; buffer?: Buffer }> {
  if (typeof output === "string" && isHttpUrl(output)) {
    return { url: output };
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const resolved = await resolveProviderImage(item);
      if (resolved.url || resolved.buffer) {
        return resolved;
      }
    }
  }

  if (output && typeof output === "object") {
    const fileOutput = output as FileOutputLike;

    if (typeof fileOutput.url === "function") {
      const urlValue = fileOutput.url();
      const url = typeof urlValue === "string" ? urlValue : String(urlValue);

      if (isHttpUrl(url)) {
        return { url };
      }
    }

    if (typeof fileOutput[Symbol.asyncIterator] === "function") {
      const buffer = await readStreamToBuffer(
        fileOutput as AsyncIterable<Uint8Array>
      );
      return { buffer };
    }
  }

  throw new Error(
    `Image provider response invalid: ${describeUnknown(output)}`
  );
}

function getReplicateClient(): Replicate {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing REPLICATE_API_KEY.");
  }

  return new Replicate({
    auth: apiKey,
    useFileOutput: false,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type ReplicatePredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "aborted";

type ReplicatePrediction = {
  id: string;
  status: ReplicatePredictionStatus | string;
  output?: unknown;
  error?: unknown;
};

function formatReplicateError(error: unknown): string {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  const described = describeUnknown(error);
  return described === "null" || described === "undefined"
    ? "unknown error"
    : described;
}

/**
 * Create a Replicate prediction and poll until it completes. Never returns
 * a still-processing (null) output — throws a clear timeout/failure instead.
 */
async function createAndPollImagePrediction(
  replicate: Replicate,
  model: typeof FLUX_SCHNELL | typeof FLUX_KONTEXT,
  input: Record<string, unknown>
): Promise<unknown> {
  let prediction: ReplicatePrediction;
  try {
    prediction = (await replicate.predictions.create({
      model,
      input,
    })) as ReplicatePrediction;
  } catch (err: unknown) {
    console.error("[replicate] create error:", JSON.stringify(err, null, 2));
    throw new Error(`Image provider call failed: ${String(err)}`);
  }

  if (!prediction?.id) {
    throw new Error("Replicate prediction failed: missing prediction id.");
  }

  const deadline = Date.now() + IMAGE_POLL_MAX_WAIT_MS;
  console.log(
    `[replicate] prediction ${prediction.id} status: ${prediction.status}`
  );

  while (
    prediction.status === "starting" ||
    prediction.status === "processing"
  ) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Replicate image timed out (still ${prediction.status} after ${IMAGE_POLL_MAX_WAIT_MS / 1000}s)`
      );
    }

    await delay(IMAGE_POLL_INTERVAL_MS);

    try {
      prediction = (await replicate.predictions.get(
        prediction.id
      )) as ReplicatePrediction;
    } catch (err: unknown) {
      console.error("[replicate] poll error:", JSON.stringify(err, null, 2));
      throw new Error(`Image provider poll failed: ${String(err)}`);
    }

    console.log(
      `[replicate] prediction ${prediction.id} status: ${prediction.status}`
    );
  }

  if (prediction.status === "failed" || prediction.status === "canceled" || prediction.status === "aborted") {
    throw new Error(
      `Replicate prediction failed: ${formatReplicateError(prediction.error)}`
    );
  }

  if (prediction.status !== "succeeded") {
    throw new Error(
      `Replicate prediction ended with unexpected status '${prediction.status}'.`
    );
  }

  if (prediction.output === null || prediction.output === undefined) {
    throw new Error(
      "Replicate prediction succeeded but output was empty."
    );
  }

  console.log("[replicate] output:", prediction.output);
  return prediction.output;
}

export async function generateImageFromPrompt(
  params: GenerateImageParams
): Promise<{ imageUrl: string; mediaProvider: MediaProvider }> {
  const { prompt, companyId, postId, runId, featuredProductUrl } = params;

  let output: unknown;
  try {
    const replicate = getReplicateClient();

    if (featuredProductUrl) {
      console.log(
        `[generateImage] ${postId} -- using Flux Kontext with product reference`
      );
      output = await createAndPollImagePrediction(replicate, FLUX_KONTEXT, {
        prompt,
        input_image: featuredProductUrl,
        aspect_ratio: "1:1",
        output_format: "jpg",
        output_quality: 90,
      });
    } else {
      output = await createAndPollImagePrediction(replicate, FLUX_SCHNELL, {
        prompt,
        aspect_ratio: "1:1",
        output_format: "jpg",
        output_quality: 90,
      });
    }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.startsWith("Image provider") ||
        err.message.startsWith("Replicate "))
    ) {
      throw err;
    }
    console.error("[replicate] full error:", JSON.stringify(err, null, 2));
    throw new Error(`Image provider call failed: ${String(err)}`);
  }

  let sourceBuffer: Buffer;
  try {
    const resolved = await resolveProviderImage(output);
    if (resolved.buffer) {
      sourceBuffer = resolved.buffer;
    } else if (resolved.url) {
      sourceBuffer = await downloadImageBuffer(resolved.url);
    } else {
      throw new Error(
        `Image provider response invalid: ${describeUnknown(output)}`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Image")) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Unable to read provider output";
    throw new Error(`Image download failed: ${message}`);
  }

  let jpegBuffer: Buffer;
  try {
    jpegBuffer = await convertImageToJpeg(sourceBuffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "JPEG conversion failed";
    throw new Error(`Image conversion failed: ${message}`);
  }

  const admin = createAdminClient();
  const storagePath = `${companyId}/${postId}/image-${Date.now()}.jpg`;

  const { error: uploadError } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .upload(storagePath, jpegBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(POST_MEDIA_BUCKET).getPublicUrl(storagePath);

  if (!publicUrl) {
    throw new Error("Image upload failed: could not resolve public URL.");
  }

  await logCostEvent({
    companyId,
    runId: runId ?? null,
    postId,
    provider: "flux",
    model: "flux-schnell",
    stepName: "image_generation",
    estimatedCostUsd: estimateFluxCost(),
  });

  return {
    imageUrl: publicUrl,
    mediaProvider: "flux",
  };
}

/** Grace period before treating a producing post with no operation id as stranded. */
export const VIDEO_KICKOFF_GRACE_MS = 10 * 60 * 1000;

const VIDEO_NEVER_SUBMITTED_MESSAGE =
  "Video was never submitted for generation (no operation id)";

export async function markPostFailed(
  postId: string,
  error: unknown
): Promise<void> {
  const admin = createAdminClient();
  const errorMessage = sanitizeErrorMessage(error);

  await admin
    .from("posts")
    .update({
      pipeline_stage: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

function normalizeContentType(
  value: string
): ProduceVisualParams["contentType"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "video" || normalized === "carousel") {
    return normalized;
  }

  return "image";
}

function isPastVideoKickoffGrace(
  timestamps: { updated_at?: string | null; created_at?: string | null }
): boolean {
  const raw = timestamps.updated_at ?? timestamps.created_at;
  if (!raw) {
    return true;
  }

  const ageMs = Date.now() - new Date(raw).getTime();
  return ageMs >= VIDEO_KICKOFF_GRACE_MS;
}

type VideoPostForBranding = {
  video_url: string;
  company_id: string;
  caption: string | null;
  concept: string | null;
  platform: string;
};

async function finalizeVideoWithCreatomate(
  postId: string,
  post: VideoPostForBranding
): Promise<void> {
  const admin = createAdminClient();

  if (post.video_url && process.env.CREATOMATE_API_KEY) {
    try {
      console.log(`[produceVisual] ${postId} -- sending to Creatomate`);
      const brandedUrl = await composeVideo({
        videoUrl: post.video_url,
        postId,
        companyId: post.company_id,
        caption: post.caption ?? post.concept ?? "",
        platform: post.platform ?? "instagram",
      });

      const { error: brandedError } = await admin
        .from("posts")
        .update({
          branded_video_url: brandedUrl,
          pipeline_stage: "ready",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (brandedError) {
        throw new Error(`Post ready update failed: ${brandedError.message}`);
      }
    } catch (err) {
      console.error(
        `[produceVisual] ${postId} -- Creatomate failed, using raw video:`,
        err
      );

      const { error: readyError } = await admin
        .from("posts")
        .update({
          pipeline_stage: "ready",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (readyError) {
        throw new Error(`Post ready update failed: ${readyError.message}`);
      }
    }
  } else {
    const { error: readyError } = await admin
      .from("posts")
      .update({
        pipeline_stage: "ready",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (readyError) {
      throw new Error(`Post ready update failed: ${readyError.message}`);
    }
  }

  await checkRunGate2Notification(postId);
}

export async function produceVisual(params: ProduceVisualParams): Promise<void> {
  const { postId, companyId, concept, contentType, brandConfig, context } =
    params;
  const admin = createAdminClient();

  logStep(postId, `starting for company ${companyId}`);

  const { data: post, error: postError } = await admin
    .from("posts")
    .select(
      "id, company_id, pipeline_stage, image_url, video_url, suggested_time_tag, featured_product_id, voice_over_script"
    )
    .eq("id", postId)
    .single();

  if (postError || !post) {
    throw new Error(postError?.message ?? `Post ${postId} not found.`);
  }

  if (
    post.pipeline_stage === "ready" &&
    (post.image_url || post.video_url)
  ) {
    console.log(
      `[produceVisual] ${postId} - Visual already produced, skipping`
    );
    return;
  }

  try {
    logStep(postId, "updating pipeline stage to producing");
    const { error: producingError } = await admin
      .from("posts")
      .update({
        pipeline_stage: "producing",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (producingError) {
      throw new Error(
        `Post update failed: ${producingError.message}`
      );
    }

    logStep(postId, "writing prompt");
    const isVideo = contentType === "video";
    const demographic =
      parseVisualAudienceProfile(brandConfig.visual_audience_profile)
        ?.demographic ?? "local";

    const visualPrompt = isVideo
      ? await writeVideoPrompt({
          concept,
          contentType,
          brandConfig,
          context: post.suggested_time_tag ?? undefined,
          demographic,
          voiceOverScript: post.voice_over_script ?? null,
        })
      : await writeVisualPrompt({
          concept,
          contentType,
          brandConfig,
          context,
        });

    console.log(
      `[produceVisual] ${postId} - ${isVideo ? "video" : "image"} prompt:`,
      visualPrompt
    );

    if (contentType === "video") {
      logStep(postId, "starting video generation with veo");
      const { operationId } = await generateVideoFromPrompt({
        prompt: visualPrompt,
      });

      if (!operationId || typeof operationId !== "string" || !operationId.trim()) {
        throw new Error("Veo submission returned no operation id");
      }

      const { data: persisted, error: videoStartError } = await admin
        .from("posts")
        .update({
          video_operation_id: operationId,
          pipeline_stage: "producing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .select("video_operation_id")
        .single();

      if (
        videoStartError ||
        !persisted ||
        persisted.video_operation_id !== operationId
      ) {
        throw new Error(
          `Failed to persist video_operation_id for post ${postId}`
        );
      }

      logStep(postId, "video generation started, awaiting poll");
      return;
    }

    logStep(postId, "generating image with flux");

    let featuredProductUrl: string | undefined;

    if (post.featured_product_id) {
      const { data: product } = await admin
        .from("product_photos")
        .select("photo_url, name")
        .eq("id", post.featured_product_id)
        .maybeSingle();

      if (product?.photo_url) {
        featuredProductUrl = product.photo_url;
        console.log(
          `[produceVisual] ${postId} -- featuring product: ${product.name}`
        );
      }
    }

    const { imageUrl } = await generateImageFromPrompt({
      prompt: visualPrompt,
      companyId,
      postId,
      runId: context?.runId ?? null,
      featuredProductUrl,
    });

    logStep(postId, "marking post ready");
    const { error: readyError } = await admin
      .from("posts")
      .update({
        image_url: imageUrl,
        pipeline_stage: "ready",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (readyError) {
      throw new Error(`Post ready update failed: ${readyError.message}`);
    }

    await checkRunGate2Notification(postId);

    logStep(postId, "completed");
  } catch (error) {
    await markPostFailed(postId, error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function pollVideoCompletion(postId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: post, error: postError } = await admin
    .from("posts")
    .select(
      "id, company_id, pipeline_stage, video_operation_id, video_url, caption, concept, platform, updated_at, created_at"
    )
    .eq("id", postId)
    .single();

  if (postError || !post) {
    throw new Error(postError?.message ?? `Post ${postId} not found.`);
  }

  if (post.pipeline_stage !== "producing") {
    return;
  }

  if (!post.video_operation_id) {
    if (!isPastVideoKickoffGrace(post)) {
      return;
    }

    await markPostFailed(postId, VIDEO_NEVER_SUBMITTED_MESSAGE);
    return;
  }

  if (post.video_url) {
    await finalizeVideoWithCreatomate(postId, {
      video_url: post.video_url,
      company_id: post.company_id,
      caption: post.caption,
      concept: post.concept,
      platform: post.platform,
    });
    return;
  }

  try {
    const result = await checkVideoOperation({
      operationId: post.video_operation_id,
      companyId: post.company_id,
      postId,
    });

    if (!result.done) {
      return;
    }

    if (!result.videoUrl) {
      throw new Error("Video operation completed without output URL.");
    }

    const videoUrl = result.videoUrl;

    const { error: videoSaveError } = await admin
      .from("posts")
      .update({
        video_url: videoUrl,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (videoSaveError) {
      throw new Error(`Post video update failed: ${videoSaveError.message}`);
    }

    await finalizeVideoWithCreatomate(postId, {
      video_url: videoUrl,
      company_id: post.company_id,
      caption: post.caption,
      concept: post.concept,
      platform: post.platform,
    });
  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error);
    await admin
      .from("posts")
      .update({
        pipeline_stage: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function generateVisual(postId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: post, error: postError } = await admin
    .from("posts")
    .select("id, company_id, concept, content_type")
    .eq("id", postId)
    .single();

  if (postError || !post) {
    throw new Error(postError?.message ?? `Post ${postId} not found.`);
  }

  const { data: brandConfig, error: brandError } = await admin
    .from("brand_configs")
    .select("*")
    .eq("company_id", post.company_id)
    .single();

  if (brandError || !brandConfig) {
    throw new Error(
      brandError?.message ?? `Brand config for post ${postId} not found.`
    );
  }

  await produceVisual({
    postId: post.id,
    companyId: post.company_id,
    concept: post.concept ?? "",
    contentType: normalizeContentType(post.content_type),
    brandConfig: brandConfig as BrandConfig,
  });
}
