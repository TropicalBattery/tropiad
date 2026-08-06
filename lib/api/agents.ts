import { generateCaption } from "@/lib/agents/copywriter";
import { generateVisual } from "@/lib/agents/visual";
import type { Post } from "@/lib/supabase/types";
import { canGenerateCaption, toCaptionPlatform } from "@/lib/utils/posts";

function logAgentError(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${label}]`, message);
}

export function triggerGenerateCaption(post: Post) {
  if (!canGenerateCaption(post)) {
    logAgentError("generateCaption", "Post is missing a concept.");
    return;
  }

  void generateCaption(
    post.company_id,
    post.id,
    toCaptionPlatform(post.platform),
    post.concept
  ).catch((error) => logAgentError("generateCaption", error));
}

export function triggerGate2Revision(post: Post) {
  triggerGenerateCaption(post);
  void generateVisual(post.id).catch((error) =>
    logAgentError("generateVisual", error)
  );
}
