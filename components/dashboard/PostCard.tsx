"use client";

import { format } from "date-fns";
import { Check, Clock, Pencil, Play, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { ContentTypeBadge } from "@/components/dashboard/PlatformBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Post } from "@/lib/supabase/types";

type PostCardProps = {
  post: Post;
  companyName: string;
  disabled: boolean;
  onApprove: (postId: string) => Promise<void>;
  onPublishNow: (postId: string) => Promise<void>;
  onReject: (post: Post) => void;
  onRequestEdit: (postId: string, feedback: string) => Promise<void>;
};

function getCompanyInitial(name: string) {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || "?";
}

function PostMediaPreview({ post }: { post: Post }) {
  if (post.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.image_url}
        alt="Post preview"
        className="h-full w-full object-cover"
      />
    );
  }

  if (post.video_url) {
    return (
      <>
        <video
          src={post.video_url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            <Play className="h-4 w-4 fill-white text-[#111111] dark:text-white" />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-surface-hover">
      <Sparkles className="h-8 w-8 text-text-muted" aria-hidden />
    </div>
  );
}

export function PostCard({
  post,
  companyName,
  disabled,
  onApprove,
  onPublishNow,
  onReject,
  onRequestEdit,
}: PostCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  const platformLabel = post.platform.toUpperCase();
  const caption = post.caption ?? "No caption provided.";
  const canApprove = !disabled;

  async function handleRequestEdit() {
    if (!feedback.trim()) {
      return;
    }
    await onRequestEdit(post.id, feedback.trim());
    setFeedback("");
    setShowFeedback(false);
  }

  async function handleApprove() {
    await onApprove(post.id);
  }

  async function handlePublishNow() {
    await onPublishNow(post.id);
  }

  return (
    <article className="surface-card flex h-full w-full max-w-[360px] flex-col overflow-hidden">
      <div className="relative aspect-square w-full overflow-hidden rounded-t-[12px] bg-bg-surface-hover">
        <PostMediaPreview post={post} />
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-accent-teal backdrop-blur-sm">
          GATE 2 - READY
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(204,43,43,0.18)] text-[10px] font-semibold text-accent-violet"
            >
              {getCompanyInitial(companyName)}
            </div>
            <span className="truncate text-xs font-medium uppercase tracking-wide text-text-muted">
              {platformLabel}
            </span>
          </div>
          <ContentTypeBadge contentType={post.content_type} />
        </div>

        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-text-primary">
          {caption}
        </p>

        {post.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.hashtags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag.replace(/^#/, "")}
              </Badge>
            ))}
          </div>
        )}

        {post.gate2_status === "approved" && post.scheduled_at && (
          <p className="mt-2 flex items-center gap-1 text-xs text-[#9ca3af] dark:text-slate-500">
            <Clock size={11} /> Scheduled for{" "}
            {format(new Date(post.scheduled_at), "MMM d, yyyy h:mm a")}
          </p>
        )}

        {showFeedback && (
          <div className="mt-3 space-y-2 rounded-lg border border-border-subtle bg-bg-surface-hover p-3">
            <Label htmlFor={`feedback-${post.id}`}>Edit feedback</Label>
            <Textarea
              id={`feedback-${post.id}`}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              placeholder="Describe what you'd like changed..."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={disabled || !feedback.trim()}
                onClick={() => void handleRequestEdit()}
              >
                Submit feedback
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  setFeedback("");
                  setShowFeedback(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!showFeedback && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
            <Button
              type="button"
              size="sm"
              disabled={!canApprove}
              onClick={() => void handleApprove()}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canApprove}
              onClick={() => void handlePublishNow()}
            >
              <Send className="mr-1.5 h-4 w-4" />
              Publish now
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={disabled}
              onClick={() => onReject(post)}
            >
              <X className="mr-1.5 h-4 w-4" />
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => setShowFeedback(true)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
