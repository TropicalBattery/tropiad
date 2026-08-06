"use client";

import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ContentTypeBadge,
  PlatformBadge,
} from "@/components/dashboard/PlatformBadge";
import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/supabase/types";
import {
  buildMonthGrid,
  formatCalendarMonthLabel,
  formatCalendarMonthParam,
  formatScheduleTime,
  getScheduledLocalDateKey,
  getWeekdayLabels,
  shiftCalendarMonth,
  toDateKey,
  truncateCaption,
} from "@/lib/utils/calendar";
import { formatScheduleDisplay } from "@/lib/utils/dashboard";

type ClientCalendarViewProps = {
  posts: Post[];
  timezone: string;
  year: number;
  month: number;
};

function getScheduleStatus(pipelineStage: string): {
  label: "POSTED" | "SCHEDULED";
  posted: boolean;
} {
  if (pipelineStage === "published") {
    return { label: "POSTED", posted: true };
  }

  return { label: "SCHEDULED", posted: false };
}

function groupPostsByDay(
  posts: Post[],
  timezone: string
): Map<string, Post[]> {
  const grouped = new Map<string, Post[]>();

  for (const post of posts) {
    if (!post.scheduled_at) {
      continue;
    }

    const key = getScheduledLocalDateKey(post.scheduled_at, timezone);
    const existing = grouped.get(key) ?? [];
    existing.push(post);
    grouped.set(key, existing);
  }

  for (const [key, dayPosts] of Array.from(grouped.entries())) {
    dayPosts.sort(
      (left, right) =>
        new Date(left.scheduled_at ?? 0).getTime() -
        new Date(right.scheduled_at ?? 0).getTime()
    );
    grouped.set(key, dayPosts);
  }

  return grouped;
}

export function ClientCalendarView({
  posts,
  timezone,
  year,
  month,
}: ClientCalendarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const postsByDay = useMemo(
    () => groupPostsByDay(posts, timezone),
    [posts, timezone]
  );
  const weekdayLabels = getWeekdayLabels();

  function navigateMonth(delta: number) {
    const next = shiftCalendarMonth(year, month, delta);
    const query = formatCalendarMonthParam(next.year, next.month);
    router.push(`${pathname}?month=${query}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-text-primary">
          Content calendar
        </h2>
        <p className="text-sm text-text-muted">
          Scheduled and published posts for {companyMonthLabel(year, month)}
        </p>
      </div>

      <div className="relative">
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => navigateMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-display text-lg font-semibold text-text-primary">
              {formatCalendarMonthLabel(year, month)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => navigateMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 border-b border-border-subtle bg-bg-surface-hover">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-center font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const dateKey = toDateKey(cell.year, cell.month, cell.day);
              const dayPosts = postsByDay.get(dateKey) ?? [];

              return (
                <div
                  key={dateKey}
                  className="min-h-[120px] border-b border-r border-border-subtle p-2 last:border-r-0"
                >
                  <p
                    className={
                      cell.inCurrentMonth
                        ? "text-sm font-medium text-text-primary"
                        : "text-sm text-text-muted/50"
                    }
                  >
                    {cell.day}
                  </p>

                  {cell.inCurrentMonth && dayPosts.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {dayPosts.map((post) => {
                        const status = getScheduleStatus(post.pipeline_stage);

                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => setSelectedPost(post)}
                            className="w-full rounded-md border border-border-subtle bg-bg-surface-hover px-1.5 py-1 text-left transition hover:border-border-glow"
                          >
                            <div className="flex items-center gap-1">
                              <ContentTypeBadge
                                contentType={post.content_type}
                                className="px-1.5 py-0 text-[9px]"
                              />
                              <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                                {post.scheduled_at
                                  ? formatScheduleTime(
                                      post.scheduled_at,
                                      timezone
                                    )
                                  : ""}
                              </span>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-text-primary">
                              {truncateCaption(post.caption ?? post.concept)}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1">
                              {status.posted ? (
                                <Check className="h-3 w-3 text-accent-teal" />
                              ) : null}
                              <span
                                className={
                                  status.posted
                                    ? "font-mono text-[9px] uppercase tracking-wider text-accent-teal"
                                    : "font-mono text-[9px] uppercase tracking-wider text-accent-amber"
                                }
                              >
                                {status.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedPost && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-10 rounded-2xl bg-black/55"
              onClick={() => setSelectedPost(null)}
              aria-label="Close post details overlay"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-post-detail-title"
              className="absolute left-1/2 top-1/2 z-20 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PlatformBadge platform={selectedPost.platform} />
                  <h3
                    id="calendar-post-detail-title"
                    className="mt-3 font-display text-lg font-semibold text-text-primary"
                  >
                    Scheduled post
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="rounded-lg p-2 text-text-muted hover:bg-bg-surface-hover"
                  aria-label="Close post details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl bg-bg-surface-hover">
                {selectedPost.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPost.image_url}
                    alt="Post preview"
                    className="max-h-72 w-full object-cover"
                  />
                ) : selectedPost.video_url ? (
                  <video
                    src={selectedPost.video_url}
                    controls
                    playsInline
                    className="max-h-72 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-text-muted">
                    No media available
                  </div>
                )}
              </div>

              <dl className="mt-4 space-y-3 text-sm">
                <DetailRow
                  label="Scheduled"
                  value={
                    selectedPost.scheduled_at
                      ? formatScheduleDisplay(
                          selectedPost.scheduled_at,
                          timezone
                        )
                      : "Not scheduled"
                  }
                />
                <DetailRow
                  label="Status"
                  value={
                    getScheduleStatus(selectedPost.pipeline_stage).label
                  }
                  badgeClassName={
                    selectedPost.pipeline_stage === "published"
                      ? "text-accent-teal"
                      : "text-accent-amber"
                  }
                />
                <DetailRow
                  label="Content type"
                  value={selectedPost.content_type}
                />
                <div>
                  <dt className="text-text-muted">Caption</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-text-primary">
                    {selectedPost.caption ??
                      selectedPost.concept ??
                      "No caption provided."}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  badgeClassName,
}: {
  label: string;
  value: string;
  badgeClassName?: string;
}) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd
        className={
          badgeClassName
            ? `mt-1 font-mono text-[11px] uppercase tracking-wider ${badgeClassName}`
            : "mt-1 text-text-primary"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function companyMonthLabel(year: number, month: number): string {
  return formatCalendarMonthLabel(year, month);
}
