import { createAdminClient } from "@/lib/supabase/admin";
import { logCostEvent } from "@/lib/agents/cost-tracking";
import type { BrandConfig, Post } from "@/lib/supabase/types";

const ZERNIO_BASE_URL = "https://zernio.com/api/v1";

type PublishPostContext = {
  companyId?: string;
  runId?: string;
  /** When true, create the Zernio post with publishNow instead of scheduledFor. */
  immediate?: boolean;
};

type ZernioAccountIds = Record<string, string>;

type ZernioCreatePostResponse = {
  id?: string;
  post_id?: string;
  post?: {
    _id?: string;
    id?: string;
  };
  data?: {
    id?: string;
    post_id?: string;
  };
};

type ZernioMediaItem = {
  type: "image" | "video";
  url: string;
};

type ZernioAnalyticsResponse = {
  impressions?: number;
  reach?: number;
  engagement?: number;
  engagement_rate?: number;
  clicks?: number;
  data?: ZernioAnalyticsResponse;
};

type ZernioConnectResponse = {
  oauth_url?: string;
  url?: string;
  data?: {
    oauth_url?: string;
    url?: string;
  };
};

function getZernioApiKey(): string {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ZERNIO_API_KEY.");
  }
  return apiKey;
}

async function zernioRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getZernioApiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { message?: string; error?: string })
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      (body && "message" in body && body.message) ||
      (body && "error" in body && body.error) ||
      `Zernio API error (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

function normalizePlatformKey(platform: string): string {
  return platform.trim().toLowerCase();
}

function toZernioPublishPlatform(platform: string): string {
  const key = normalizePlatformKey(platform);
  if (key === "x") {
    return "twitter";
  }
  return key;
}

function parseAccountIds(value: BrandConfig["zernio_account_ids"]): ZernioAccountIds {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  return Object.fromEntries(
    entries.map(([platform, accountId]) => [
      normalizePlatformKey(platform),
      accountId,
    ])
  );
}

function resolveAccountId(
  accountIds: ZernioAccountIds,
  platform: string
): string {
  const key = normalizePlatformKey(platform);
  const aliases = [key, key === "x" ? "twitter" : key];

  for (const alias of aliases) {
    if (accountIds[alias]) {
      return accountIds[alias];
    }
  }

  throw new Error(`No Zernio account configured for platform "${platform}".`);
}

function formatHashtags(hashtags: string[]): string {
  if (hashtags.length === 0) {
    return "";
  }

  return hashtags
    .map((tag) => `#${tag.replace(/^#+/, "").trim()}`)
    .filter(Boolean)
    .join(" ");
}

function buildPostContent(post: Post): string {
  const caption = post.caption?.trim() ?? "";
  const hashtags = formatHashtags(post.hashtags ?? []);

  if (!caption && !hashtags) {
    throw new Error("Post is missing caption and hashtags.");
  }

  return [caption, hashtags].filter(Boolean).join("\n\n");
}

function buildMediaItems(post: Post): ZernioMediaItem[] {
  const videoToPublish = post.branded_video_url || post.video_url;
  if (videoToPublish) {
    return [{ type: "video", url: videoToPublish }];
  }

  if (post.image_url) {
    return [{ type: "image", url: post.image_url }];
  }

  return [];
}

function extractZernioPostId(response: ZernioCreatePostResponse): string {
  const id =
    response.id ??
    response.post_id ??
    response.post?._id ??
    response.post?.id ??
    response.data?.id ??
    response.data?.post_id;

  if (!id) {
    throw new Error("Zernio did not return a post ID.");
  }

  return id;
}

async function fetchPost(postId: string): Promise<Post> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Post ${postId} not found.`);
  }

  return data;
}

async function fetchBrandConfig(companyId: string): Promise<BrandConfig> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_configs")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? `Brand config not found for company ${companyId}.`
    );
  }

  return data;
}

export async function publishPost(
  postId: string,
  context?: PublishPostContext
): Promise<{ success: boolean; zernio_post_id: string }> {
  const supabase = createAdminClient();
  let post = await fetchPost(postId);
  const immediate = Boolean(context?.immediate);

  if (post.zernio_post_id) {
    console.log(
      `[publishPost] ${postId} already has zernio_post_id, skipping`
    );
    await supabase
      .from("posts")
      .update({ pipeline_stage: "published" })
      .eq("id", postId);

    return { success: true, zernio_post_id: post.zernio_post_id };
  }

  if (post.pipeline_stage === "published") {
    console.log(`[publishPost] ${postId} already published, skipping`);
    return { success: true, zernio_post_id: "" };
  }

  const brand = await fetchBrandConfig(post.company_id);
  const accountIds = parseAccountIds(brand.zernio_account_ids);
  const accountId = resolveAccountId(accountIds, post.platform);
  const platform = toZernioPublishPlatform(post.platform);

  if (immediate && !post.scheduled_at) {
    const nowIso = new Date().toISOString();
    const { error: scheduleError } = await supabase
      .from("posts")
      .update({ scheduled_at: nowIso })
      .eq("id", postId);

    if (scheduleError) {
      throw new Error(scheduleError.message);
    }

    post = { ...post, scheduled_at: nowIso };
  }

  if (!post.scheduled_at) {
    throw new Error("Post is missing scheduled_at.");
  }

  const mediaItems = buildMediaItems(post);
  const payload = {
    content: buildPostContent(post),
    platforms: [{ platform, accountId }],
    ...(immediate
      ? { publishNow: true as const }
      : { scheduledFor: new Date(post.scheduled_at).toISOString() }),
    ...(mediaItems.length > 0 ? { mediaItems } : {}),
  };

  try {
    const response = await zernioRequest<ZernioCreatePostResponse>("/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const zernioPostId = extractZernioPostId(response);
    const publishedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("posts")
      .update({
        zernio_post_id: zernioPostId,
        pipeline_stage: "published",
        published_at: publishedAt,
        error_message: null,
      })
      .eq("id", postId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (context?.companyId) {
      await logCostEvent({
        companyId: context.companyId,
        runId: context.runId ?? null,
        postId,
        provider: "zernio",
        model: null,
        stepName: "publish_check",
        estimatedCostUsd: 0,
      });
    }

    return { success: true, zernio_post_id: zernioPostId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to publish post.";

    await supabase
      .from("posts")
      .update({
        pipeline_stage: "failed",
        error_message: message,
      })
      .eq("id", postId);

    throw error;
  }
}

export async function getPostAnalytics(postId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("zernio_post_id, company_id")
    .eq("id", postId)
    .single();

  if (!post?.zernio_post_id) {
    return;
  }

  try {
    const response = await zernioRequest<ZernioAnalyticsResponse>(
      `/posts/${post.zernio_post_id}/analytics`
    );
    const analytics = response.data ?? response;

    await supabase
      .from("posts")
      .update({
        impressions: analytics.impressions ?? null,
        reach: analytics.reach ?? null,
        engagement: analytics.engagement_rate ?? analytics.engagement ?? null,
        clicks: analytics.clicks ?? null,
        analytics_pulled_at: new Date().toISOString(),
      })
      .eq("id", postId);
  } catch (err) {
    console.warn(`[analytics] Failed to pull for post ${postId}:`, err);
  }
}

export async function connectAccount(
  companyId: string,
  platform: string
): Promise<{ oauth_url: string }> {
  const brand = await fetchBrandConfig(companyId);
  const zernioPlatform = toZernioPublishPlatform(platform);

  const response = await zernioRequest<ZernioConnectResponse>("/connect", {
    method: "POST",
    body: JSON.stringify({
      platform: zernioPlatform,
      profileId: brand.zernio_profile_id,
    }),
  });

  const oauthUrl =
    response.oauth_url ??
    response.url ??
    response.data?.oauth_url ??
    response.data?.url;

  if (!oauthUrl) {
    throw new Error("Zernio did not return an OAuth URL.");
  }

  return { oauth_url: oauthUrl };
}

/** @deprecated Use publishPost(postId) instead. */
export async function schedulePost(post: Post) {
  return publishPost(post.id);
}
