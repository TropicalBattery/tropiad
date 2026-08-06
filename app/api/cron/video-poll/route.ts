import { apiError, apiSuccess } from "@/lib/api/response";
import { pollVideoCompletion } from "@/lib/agents/visual";
import { createAdminClient } from "@/lib/supabase/admin";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return Boolean(process.env.CRON_SECRET) && authHeader === expected;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return apiError("Unauthorized", 401);
  }

  const admin = createAdminClient();
  // All producing posts: poll when video_operation_id is set; reap aged
  // null-id orphans inside pollVideoCompletion (grace threshold).
  const { data: posts, error } = await admin
    .from("posts")
    .select("id")
    .eq("pipeline_stage", "producing");

  if (error) {
    return apiError(error.message, 500);
  }

  let checked = 0;
  for (let index = 0; index < (posts ?? []).length; index += 1) {
    const post = posts![index];

    if (index > 0) {
      await delay(1000);
    }

    try {
      await pollVideoCompletion(post.id);
      checked += 1;
    } catch (pollError) {
      console.error(
        `[cron/video-poll] Post ${post.id} poll failed:`,
        pollError
      );
      checked += 1;
    }
  }

  return apiSuccess({ checked });
}
