import type { Platform } from "@/lib/agents/copywriter";
import type { Post } from "@/lib/supabase/types";

export function toCaptionPlatform(platform: string): Platform {
  const key = platform.trim().toLowerCase();

  switch (key) {
    case "instagram":
      return "instagram";
    case "linkedin":
      return "linkedin";
    case "x":
    case "twitter":
      return "x";
    case "facebook":
      return "facebook";
    default:
      throw new Error(`Unsupported platform for caption generation: ${platform}`);
  }
}

export function canGenerateCaption(post: Post): post is Post & { concept: string } {
  return Boolean(post.concept?.trim());
}
