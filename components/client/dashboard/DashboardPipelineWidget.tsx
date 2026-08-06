"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Check,
  CheckSquare,
  ChevronRight,
  History,
  Play,
  Send,
  Settings,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { useRunNowPipeline } from "@/lib/hooks/use-run-now-pipeline";
import type { ContentRun, Post, RunStep } from "@/lib/supabase/types";
import {
  getPipelineStageIndex,
  getRunStatusBadgeClass,
} from "@/lib/utils/client-dashboard";
import { PIPELINE_STAGES } from "@/lib/utils/pipeline-stages";
import { cn } from "@/lib/utils";

/** Poll while machine work may be in flight (pending / publishing / running). */
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 4 * 60 * 1000;

type DashboardPipelineWidgetProps = {
  slug: string;
  contentRun: ContentRun | null;
  runSteps: RunStep[];
  posts: Post[];
};

export function DashboardPipelineWidget({
  slug,
  contentRun,
  runSteps,
  posts,
}: DashboardPipelineWidgetProps) {
  const router = useRouter();
  const { running, runNow } = useRunNowPipeline(slug);
  const intervalRef = useRef<number | null>(null);
  const activeIndex = getPipelineStageIndex(contentRun, runSteps, posts);
  const isComplete = contentRun?.status === "complete";
  const inProgress =
    !!contentRun &&
    contentRun.status !== "complete" &&
    contentRun.status !== "failed";
  const disabled = running || inProgress;
  const runButtonLabel = running
    ? "Starting..."
    : inProgress
      ? "Run in progress"
      : "Run Now";

  // content_runs statuses used by pipeline: pending | gate1_pending |
  // gate2_pending | publishing | complete | failed (plus rare "running").
  const isActive =
    running ||
    (!!contentRun &&
      contentRun.status !== "complete" &&
      contentRun.status !== "failed" &&
      contentRun.status !== "gate1_pending" &&
      contentRun.status !== "gate2_pending");

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isActive) {
      return;
    }

    const startedAt = Date.now();
    intervalRef.current = window.setInterval(() => {
      if (Date.now() - startedAt >= POLL_MAX_MS) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, router]);

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
            This week&apos;s pipeline
          </span>
          {contentRun ? (
            <p className="mt-0.5 text-xs text-[#9ca3af] dark:text-slate-500">
              Week of {format(new Date(contentRun.week_start), "MMM d, yyyy")}
            </p>
          ) : null}
          {isActive ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#B45309]">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F5A000]"
                aria-hidden
              />
              Working...
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void runNow()}
          disabled={disabled}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#CC2B2B] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#B02424]",
            disabled && "cursor-not-allowed opacity-50 hover:bg-[#CC2B2B]"
          )}
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          {runButtonLabel}
        </button>
      </div>

      <div className="space-y-4">
        {PIPELINE_STAGES.map((stage, index) => {
          const completed = isComplete || activeIndex > index;
          const active = !isComplete && activeIndex === index;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  completed &&
                    "border-[#CC2B2B] bg-[#CC2B2B] text-white dark:bg-[#CC2B2B]",
                  active && "border-[#CC2B2B] bg-[#CC2B2B]/20",
                  !completed &&
                    !active &&
                    "border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#9ca3af] dark:text-slate-500"
                )}
              >
                {completed ? (
                  <Check className="h-4 w-4" />
                ) : active ? (
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#CC2B2B]" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                )}
              </div>

              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      completed || active ? "text-[#CC2B2B]" : "text-[#9ca3af] dark:text-slate-500"
                    )}
                    aria-hidden
                  />
                  <p
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-[#111111] dark:text-white" : completed ? "text-[#374151] dark:text-slate-300" : "text-[#9ca3af] dark:text-slate-500"
                    )}
                  >
                    {stage.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-[#E5E7EB] dark:border-[#2a2a2a] pt-4">
        {contentRun ? (
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
              getRunStatusBadgeClass(contentRun.status)
            )}
          >
            {contentRun.status.replace(/_/g, " ")}
          </span>
        ) : (
          <p className="text-sm text-[#6b7280] dark:text-slate-400">
            Idle - next run scheduled Sunday
          </p>
        )}

        <div className="mt-3 border-t border-[#E5E7EB] dark:border-[#2a2a2a] pt-3">
          <Link
            href={`/dashboard/${slug}/cycles`}
            className="flex items-center gap-1.5 text-xs text-[#9ca3af] dark:text-slate-500 transition-colors hover:text-violet-400"
          >
            <History size={12} />
            View previous cycles
          </Link>
        </div>
      </div>
    </div>
  );
}

type QuickActionsWidgetProps = {
  slug: string;
};

const QUICK_ACTIONS = [
  {
    label: "Review Pending Posts",
    href: (slug: string) => `/dashboard/${slug}/approve`,
    icon: CheckSquare,
  },
  {
    label: "View All Posts",
    href: (slug: string) => `/dashboard/${slug}/posts`,
    icon: Send,
  },
  {
    label: "Account Settings",
    href: (slug: string) => `/dashboard/${slug}/settings`,
    icon: Settings,
  },
] as const;

export function QuickActionsWidget({ slug }: QuickActionsWidgetProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
        Quick Actions
      </h3>

      <div className="space-y-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.label}
              href={action.href(slug)}
              className="group flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]/60 px-4 py-3 transition-colors hover:border-violet-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#CC2B2B]/10">
                  <Icon className="h-4 w-4 text-[#06b6d4]" aria-hidden />
                </div>
                <span className="text-sm font-medium text-[#111111] dark:text-white">
                  {action.label}
                </span>
              </div>
              <ChevronRight
                className="h-4 w-4 text-[#9ca3af] dark:text-slate-500 transition-colors group-hover:text-[#CC2B2B]"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
