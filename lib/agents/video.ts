// Server-only: do not import this module into client components.
//
// Requires env: GOOGLE_AI_API_KEY
// Requires Supabase storage bucket: post-media (public read recommended)

import {
  GenerateVideosOperation,
  GoogleGenAI,
  type Video,
} from "@google/genai";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateVeoCost,
  logCostEvent,
} from "@/lib/agents/cost-tracking";

const VEO_MODEL =
  process.env.VEO_MODEL ?? "veo-3.1-fast-generate-preview";
const POST_MEDIA_BUCKET = "post-media";

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/GOOGLE_AI_API_KEY=\S+/gi, "[redacted]")
    .slice(0, 500);
}

function describeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value);
  }
}

function getGoogleAiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY.");
  }

  return new GoogleGenAI({ apiKey });
}

export async function generateVideoFromPrompt(params: {
  prompt: string;
}): Promise<{ operationId: string }> {
  const { prompt } = params;

  let operation: GenerateVideosOperation;
  try {
    const ai = getGoogleAiClient();
    // SDK GenerateVideosParameters accepts top-level `prompt` (docs also show source.prompt).
    operation = await ai.models.generateVideos({
      model: VEO_MODEL,
      prompt,
      config: {
        aspectRatio: "9:16",
      },
    });
  } catch (error) {
    throw new Error(
      `Video generation request failed: ${sanitizeErrorMessage(error)}`
    );
  }

  if (!operation.name) {
    throw new Error(
      "Video generation request failed: operation name missing from response."
    );
  }

  return { operationId: operation.name };
}

async function downloadVideoBuffer(
  ai: GoogleGenAI,
  video: Video
): Promise<Buffer> {
  if (video.videoBytes) {
    return Buffer.from(video.videoBytes, "base64");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "veo-video-"));
  const tempPath = join(tempDir, "video.mp4");

  try {
    await ai.files.download({
      file: video,
      downloadPath: tempPath,
    });
    return await readFile(tempPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function checkVideoOperation(params: {
  operationId: string;
  companyId: string;
  postId: string;
}): Promise<{ done: boolean; videoUrl: string | null }> {
  const { operationId, companyId, postId } = params;

  let operation: GenerateVideosOperation;
  try {
    const ai = getGoogleAiClient();
    const operationStub = new GenerateVideosOperation();
    operationStub.name = operationId;

    operation = await ai.operations.getVideosOperation({
      operation: operationStub,
    });
  } catch (error) {
    throw new Error(
      `Video operation check failed: ${sanitizeErrorMessage(error)}`
    );
  }

  if (!operation.done) {
    return { done: false, videoUrl: null };
  }

  if (operation.error) {
    throw new Error(
      `Video operation failed: ${describeUnknown(operation.error)}`
    );
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video || (!video.uri && !video.videoBytes)) {
    throw new Error(
      `Video operation completed without output: ${describeUnknown(operation.response)}`
    );
  }

  let videoBuffer: Buffer;
  try {
    const ai = getGoogleAiClient();
    videoBuffer = await downloadVideoBuffer(ai, video);
  } catch (error) {
    throw new Error(
      `Video download failed: ${sanitizeErrorMessage(error)}`
    );
  }

  if (videoBuffer.length === 0) {
    throw new Error("Video download failed: downloaded file was empty.");
  }

  const admin = createAdminClient();
  const storagePath = `${companyId}/${postId}/video-${Date.now()}.mp4`;

  const { error: uploadError } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .upload(storagePath, videoBuffer, {
      contentType: "video/mp4",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Video upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(POST_MEDIA_BUCKET).getPublicUrl(storagePath);

  if (!publicUrl) {
    throw new Error("Video upload failed: could not resolve public URL.");
  }

  const { data: postRow } = await admin
    .from("posts")
    .select("run_id")
    .eq("id", postId)
    .maybeSingle();

  await logCostEvent({
    companyId,
    runId: postRow?.run_id ?? null,
    postId,
    provider: "veo",
    model: VEO_MODEL,
    stepName: "video_generation",
    estimatedCostUsd: estimateVeoCost(8),
  });

  return { done: true, videoUrl: publicUrl };
}
