import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type ZernioWebhookPayload = {
  zernio_post_id?: string;
  post_id?: string;
  id?: string;
  event?: string;
  status?: string;
};

function extractZernioPostId(payload: ZernioWebhookPayload): string | null {
  return payload.zernio_post_id ?? payload.post_id ?? payload.id ?? null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ZernioWebhookPayload;
    const zernioPostId = extractZernioPostId(payload);

    if (!zernioPostId) {
      return NextResponse.json(
        { error: "Missing Zernio post ID in webhook payload." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const publishedAt = new Date().toISOString();

    const { data: post, error: findError } = await supabase
      .from("posts")
      .select("id")
      .eq("zernio_post_id", zernioPostId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!post) {
      return NextResponse.json(
        { error: "No matching post found for Zernio post ID." },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({
        published_at: publishedAt,
        pipeline_stage: "published",
        error_message: null,
      })
      .eq("id", post.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
