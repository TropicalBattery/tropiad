import { NextResponse } from "next/server";

import { publishPost } from "@/lib/agents/scheduler";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: {
    id: string;
  };
};

type PublishBody = {
  immediate?: boolean;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    let body: PublishBody = {};
    try {
      body = (await request.json()) as PublishBody;
    } catch {
      body = {};
    }

    const immediate = Boolean(body.immediate);
    const supabase = createAdminClient();

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    if (post.gate2_status !== "approved") {
      return NextResponse.json(
        { error: "Post must be approved before publishing." },
        { status: 400 }
      );
    }

    const result = await publishPost(
      params.id,
      immediate ? { immediate: true } : undefined
    );

    return NextResponse.json({
      ok: true,
      postId: post.id,
      zernio_post_id: result.zernio_post_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to publish post.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
