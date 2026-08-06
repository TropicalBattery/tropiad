"use client";

import { Check, CheckCircle, Pencil, X } from "lucide-react";
import { useState } from "react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Post } from "@/lib/supabase/types";
import type { RejectionGate } from "@/lib/constants/rejection-reasons";
import { cn } from "@/lib/utils";

type Gate1QueueProps = {
  posts: Post[];
  onApprove: (postId: string) => Promise<void>;
  onReject: (post: Post, gate: RejectionGate) => void;
  onEditSave: (postId: string, concept: string) => Promise<void>;
  onBulkApprove: () => Promise<void>;
  isUpdating: boolean;
  awaitingLabel?: string;
  approveAllLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  showBulkApprove?: boolean;
};

function contentTypeClass(contentType: string): string {
  if (contentType === "Video") {
    return "bg-rose-900/40 text-rose-300 border-rose-800";
  }

  if (contentType === "Carousel") {
    return "bg-amber-900/40 text-amber-300 border-amber-800";
  }

  return "bg-tbc-red-900/40 text-tbc-red-300 border-tbc-red-800";
}

export function Gate1Queue({
  posts,
  onApprove,
  onReject,
  onEditSave,
  onBulkApprove,
  isUpdating,
  awaitingLabel,
  approveAllLabel = "Approve all",
  emptyTitle = "No new ideas are awaiting approval for this cycle.",
  emptyDescription,
  showBulkApprove = true,
}: Gate1QueueProps) {
  const countLabel =
    awaitingLabel ??
    `${posts.length} concept${posts.length === 1 ? "" : "s"} awaiting approval`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">{countLabel}</p>
        {showBulkApprove && posts.length > 0 && (
          <Button
            type="button"
            disabled={isUpdating}
            onClick={() => void onBulkApprove()}
          >
            <Check className="mr-2 h-4 w-4" />
            {approveAllLabel}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-10 text-center">
            <CheckCircle size={28} className="text-emerald-500" />
            <p className="text-sm font-medium text-[#6b7280] dark:text-slate-400">
              {emptyTitle}
            </p>
            {emptyDescription ? (
              <p className="text-xs text-slate-600">{emptyDescription}</p>
            ) : null}
          </div>
        ) : (
          posts.map((post) => (
            <ConceptCard
              key={post.id}
              post={post}
              disabled={isUpdating}
              onApprove={onApprove}
              onReject={onReject}
              onEditSave={onEditSave}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConceptCard({
  post,
  disabled,
  onApprove,
  onReject,
  onEditSave,
}: {
  post: Post;
  disabled: boolean;
  onApprove: (postId: string) => Promise<void>;
  onReject: (post: Post, gate: RejectionGate) => void;
  onEditSave: (postId: string, concept: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [conceptDraft, setConceptDraft] = useState(post.concept ?? "");

  async function handleSaveEdit() {
    if (!conceptDraft.trim()) {
      return;
    }
    await onEditSave(post.id, conceptDraft.trim());
    setIsEditing(false);
  }

  return (
    <div className="flex cursor-default flex-col gap-3 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-4 transition-colors hover:border-[#2e2e5a]">
      <div className="flex flex-wrap items-center gap-1.5">
        <PlatformBadge platform={post.platform} />
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
            contentTypeClass(post.content_type)
          )}
        >
          {post.content_type}
        </span>
      </div>

      {isEditing ? (
        <div className="flex flex-1 flex-col gap-3">
          <Textarea
            value={conceptDraft}
            onChange={(event) => setConceptDraft(event.target.value)}
            rows={5}
            className="min-h-[120px] flex-1 border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#374151] dark:text-slate-200"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={disabled || !conceptDraft.trim()}
              onClick={() => void handleSaveEdit()}
              className="bg-violet-600 hover:bg-violet-500"
            >
              Save & approve
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setConceptDraft(post.concept ?? "");
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="flex-1 text-sm leading-relaxed text-[#374151] dark:text-slate-200">
            {post.concept ?? "No concept provided."}
          </p>

          <div className="border-t border-[#E5E7EB] dark:border-[#2a2a2a]" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onApprove(post.id)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-[#111111] dark:text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={12} />
              Approve
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onReject(post, "gate1")}
              className="flex items-center gap-1.5 rounded-lg border border-rose-700 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-900/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={12} />
              Reject
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsEditing(true)}
              className="ml-auto flex items-center gap-1 px-2 py-1.5 text-xs text-[#9ca3af] dark:text-slate-500 transition-colors hover:text-[#374151] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil size={12} />
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
