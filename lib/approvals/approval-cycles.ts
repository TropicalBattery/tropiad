import { format, parseISO, startOfWeek } from "date-fns";

import { isInProduction } from "@/lib/approvals/production-status";
import type { ContentRun, Post } from "@/lib/supabase/types";
import { getWeekStartIso } from "@/lib/utils/dashboard";

export const ALL_PENDING_RUN_VALUE = "all";

export type ApprovalCycleOption = {
  runId: string;
  weekStart: string;
  isCurrent: boolean;
  isOverdue: boolean;
  gate1Count: number;
  gate2Count: number;
  productionCount: number;
  pendingTotal: number;
};

export type ApprovalCycleGroup = {
  option: ApprovalCycleOption;
  posts: Post[];
};

export type ApprovalQueueTab = "gate1" | "production" | "gate2";

export function isGate1Pending(post: Post): boolean {
  return post.gate1_status === "pending";
}

/** Ready for final Gate 2 review — excludes in-flight production. */
export function isGate2Pending(post: Post): boolean {
  return post.gate2_status === "pending" && post.pipeline_stage === "ready";
}

export function isApprovalQueuePost(post: Post): boolean {
  return (
    isGate1Pending(post) || isGate2Pending(post) || isInProduction(post)
  );
}

export function resolveApprovalTab(
  tab: string | null | undefined
): ApprovalQueueTab {
  if (tab === "production") {
    return "production";
  }
  if (tab === "posts" || tab === "gate2") {
    return "gate2";
  }
  return "gate1";
}

export function approvalTabToQuery(tab: ApprovalQueueTab): string {
  if (tab === "production") {
    return "production";
  }
  if (tab === "gate2") {
    return "posts";
  }
  return "concepts";
}

/** Parse yyyy-MM-dd as a local calendar date (avoids UTC day shift). */
export function parseWeekStartDate(weekStart: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    const [year, month, day] = weekStart.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return parseISO(weekStart);
}

export function formatWeekOfLabel(weekStart: string): string {
  return `Week of ${format(parseWeekStartDate(weekStart), "MMM d, yyyy")}`;
}

export function weekStartFromTimestamp(iso: string): string {
  return format(startOfWeek(new Date(iso), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function buildApprovalCycleOptions(
  posts: Post[],
  runs: Pick<ContentRun, "id" | "week_start">[],
  currentWeekStart: string = getWeekStartIso()
): ApprovalCycleOption[] {
  const runById = new Map(runs.map((run) => [run.id, run]));
  const queuePosts = posts.filter(isApprovalQueuePost);

  const counts = new Map<
    string,
    { gate1: number; gate2: number; production: number; weekStart: string }
  >();

  for (const post of queuePosts) {
    if (!post.run_id) {
      continue;
    }

    const run = runById.get(post.run_id);
    const weekStart =
      run?.week_start ??
      (post.created_at
        ? weekStartFromTimestamp(post.created_at)
        : currentWeekStart);

    const existing = counts.get(post.run_id) ?? {
      gate1: 0,
      gate2: 0,
      production: 0,
      weekStart,
    };

    if (isGate1Pending(post)) {
      existing.gate1 += 1;
    }
    if (isGate2Pending(post)) {
      existing.gate2 += 1;
    }
    if (isInProduction(post)) {
      existing.production += 1;
    }

    if (run?.week_start) {
      existing.weekStart = run.week_start;
    }

    counts.set(post.run_id, existing);
  }

  const options: ApprovalCycleOption[] = Array.from(counts.entries())
    .map(([runId, value]) => {
      const pendingTotal = value.gate1 + value.gate2 + value.production;
      const isCurrent = value.weekStart === currentWeekStart;
      return {
        runId,
        weekStart: value.weekStart,
        isCurrent,
        isOverdue: !isCurrent,
        gate1Count: value.gate1,
        gate2Count: value.gate2,
        productionCount: value.production,
        pendingTotal,
      };
    })
    .filter((option) => option.pendingTotal > 0)
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));

  return options;
}

/**
 * Default: current week with pending, else newest older cycle with pending.
 * Honours a valid URL `run` value when provided.
 */
export function resolveRunSelection(
  options: ApprovalCycleOption[],
  urlRun: string | null | undefined
): string {
  if (options.length === 0) {
    return ALL_PENDING_RUN_VALUE;
  }

  if (urlRun === ALL_PENDING_RUN_VALUE) {
    return ALL_PENDING_RUN_VALUE;
  }

  if (urlRun && options.some((option) => option.runId === urlRun)) {
    return urlRun;
  }

  const current = options.find((option) => option.isCurrent);
  if (current) {
    return current.runId;
  }

  return options[0].runId;
}

/** After a cycle disappears, pick the next best selection. */
export function resolveNextRunSelection(
  options: ApprovalCycleOption[],
  previousSelection: string
): string {
  if (options.length === 0) {
    return ALL_PENDING_RUN_VALUE;
  }

  if (previousSelection === ALL_PENDING_RUN_VALUE) {
    return ALL_PENDING_RUN_VALUE;
  }

  if (options.some((option) => option.runId === previousSelection)) {
    return previousSelection;
  }

  return resolveRunSelection(options, null);
}

export function filterPostsForRunSelection(
  posts: Post[],
  selection: string,
  gate: ApprovalQueueTab
): Post[] {
  const gateFilter =
    gate === "gate1"
      ? isGate1Pending
      : gate === "gate2"
        ? isGate2Pending
        : isInProduction;
  const gated = posts.filter(gateFilter);

  if (selection === ALL_PENDING_RUN_VALUE) {
    return gated;
  }

  return gated.filter((post) => post.run_id === selection);
}

export function groupPostsByCycle(
  posts: Post[],
  options: ApprovalCycleOption[]
): ApprovalCycleGroup[] {
  return options
    .map((option) => ({
      option,
      posts: posts.filter((post) => post.run_id === option.runId),
    }))
    .filter((group) => group.posts.length > 0);
}

export function totalPendingAcrossCycles(
  options: ApprovalCycleOption[]
): number {
  return options.reduce((sum, option) => sum + option.pendingTotal, 0);
}

export function olderUnresolvedPendingCount(
  options: ApprovalCycleOption[],
  selectedRunId: string
): number {
  const selected = options.find((option) => option.runId === selectedRunId);
  if (!selected?.isCurrent) {
    return 0;
  }

  return options
    .filter((option) => option.isOverdue)
    .reduce((sum, option) => sum + option.pendingTotal, 0);
}

export function oldestUnresolvedRunId(
  options: ApprovalCycleOption[]
): string | null {
  const overdue = options
    .filter((option) => option.isOverdue)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));

  return overdue[0]?.runId ?? null;
}

export function uniqueCycleCountForPosts(
  posts: Post[],
  options: ApprovalCycleOption[]
): number {
  const runIds = new Set(
    posts.map((post) => post.run_id).filter((id): id is string => Boolean(id))
  );
  return options.filter((option) => runIds.has(option.runId)).length;
}

export function buildCycleSummary(args: {
  selection: string;
  options: ApprovalCycleOption[];
  gate: ApprovalQueueTab;
  visibleGateCount: number;
}): string | null {
  const { selection, options, gate, visibleGateCount } = args;

  if (options.length === 0) {
    return null;
  }

  if (selection === ALL_PENDING_RUN_VALUE) {
    const total = totalPendingAcrossCycles(options);
    if (gate === "gate1") {
      return `All pending · ${visibleGateCount} concepts awaiting Gate 1 review · ${total} total pending`;
    }
    if (gate === "production") {
      const cycleCount = options.filter((o) => o.productionCount > 0).length;
      return `${visibleGateCount} posts in production across ${cycleCount} cycle${cycleCount === 1 ? "" : "s"}`;
    }
    return `All pending · ${visibleGateCount} posts ready for final approval · ${total} total pending`;
  }

  const option = options.find((item) => item.runId === selection);
  if (!option) {
    return null;
  }

  const cycleLabel = option.isCurrent ? "Current cycle" : "Overdue cycle";

  if (gate === "gate1") {
    return `${cycleLabel} · ${visibleGateCount} of ${option.pendingTotal} concepts awaiting Gate 1 review`;
  }

  if (gate === "production") {
    return `${formatWeekOfLabel(option.weekStart)} · ${visibleGateCount} posts in production`;
  }

  return `${cycleLabel} · ${visibleGateCount} posts ready for final approval`;
}

export function formatCycleOptionLabel(option: ApprovalCycleOption): string {
  const status = option.isCurrent ? "Current" : "Overdue";
  return `${formatWeekOfLabel(option.weekStart)} · ${status} · ${option.pendingTotal} pending`;
}

export function formatGroupHeadingMeta(option: ApprovalCycleOption): string {
  const status = option.isCurrent ? "Current cycle" : "Overdue";
  return `${status} · ${option.pendingTotal} pending`;
}

export function isValidRunIdParam(
  runId: string,
  companyRunIds: ReadonlySet<string>
): boolean {
  if (runId === ALL_PENDING_RUN_VALUE) {
    return true;
  }
  return companyRunIds.has(runId);
}
