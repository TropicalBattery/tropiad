"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRunNowPipeline } from "@/lib/hooks/use-run-now-pipeline";
import type {
  OverstockItem,
  OverstockRecommendation,
  QueuedOverstockSelection,
} from "@/lib/queries/overstock";
import { cn } from "@/lib/utils";

type ClientOverstockViewProps = {
  slug: string;
  items: OverstockItem[];
  initialQueued: QueuedOverstockSelection | null;
  initialRecommendations?: OverstockRecommendation[];
  userEmail: string | null;
  loadError?: string | null;
  currentRunStatus: string | null;
};

type RunActionMode = "queue_and_run" | "run_only" | "none";

type RecommendationLifecycle = "recommended" | "queued" | "generated";

function getRecommendationLifecycle(
  rec: OverstockRecommendation
): RecommendationLifecycle {
  if (rec.consumed_by_run_id) {
    return "generated";
  }
  if (rec.status === "approved") {
    return "queued";
  }
  return "recommended";
}

function getRunActionMode(
  selectedCount: number,
  queued: QueuedOverstockSelection | null
): RunActionMode {
  if (selectedCount > 0) {
    return "queue_and_run";
  }
  if (queued) {
    return "run_only";
  }
  return "none";
}

function formatCurrencyJMD(value: number): string {
  return `J$${Math.round(value).toLocaleString()}`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function CoverBadge({ months }: { months: number }) {
  const isDanger = months > 12;
  return (
    <span
      className={cn(
        "inline-flex min-w-[4.5rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        isDanger
          ? "bg-[#fdf2f2] text-[#CC2B2B]"
          : "bg-[#FFF8E6] text-[#B45309]"
      )}
    >
      {months.toFixed(1)} mo
    </span>
  );
}

function snapshotNumber(
  snapshot: Record<string, unknown> | null,
  key: string
): number | null {
  if (!snapshot) {
    return null;
  }
  const value = snapshot[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function ClientOverstockView({
  slug,
  items,
  initialQueued,
  initialRecommendations = [],
  userEmail,
  loadError = null,
  currentRunStatus,
}: ClientOverstockViewProps) {
  const router = useRouter();
  const approveHref = `/dashboard/${slug}/approve`;
  const { running, runNow } = useRunNowPipeline(slug);
  const runWouldFeatureOverstock =
    currentRunStatus == null || currentRunStatus === "pending";
  const [onlyOver12, setOnlyOver12] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [postCount, setPostCount] = useState(3);
  const [queued, setQueued] = useState<QueuedOverstockSelection | null>(
    initialQueued
  );
  const [recommendations, setRecommendations] = useState<
    OverstockRecommendation[]
  >(initialRecommendations);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    setRecommendations(initialRecommendations);
  }, [initialRecommendations]);

  useEffect(() => {
    setQueued(initialQueued);
  }, [initialQueued]);

  const visibleItems = useMemo(
    () =>
      onlyOver12
        ? items.filter((item) => item.months_of_cover > 12)
        : items,
    [items, onlyOver12]
  );

  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selected.has(item.sku)),
    [visibleItems, selected]
  );

  const selectedExcessValue = useMemo(
    () =>
      selectedItems.reduce((sum, item) => sum + item.excess_value_local, 0),
    [selectedItems]
  );

  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selected.has(item.sku));

  const runActionMode = getRunActionMode(selectedItems.length, queued);
  const actionsBusy = isPending || running || approvingId !== null;

  function toggleSku(sku: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of visibleItems) {
          next.delete(item.sku);
        }
        return next;
      });
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of visibleItems) {
        next.add(item.sku);
      }
      return next;
    });
  }

  async function queueSelection(): Promise<QueuedOverstockSelection> {
    if (selectedItems.length === 0) {
      throw new Error("Select at least one item to queue.");
    }

    const skus = selectedItems.map((item) => item.sku);
    const count = Math.min(20, Math.max(1, Math.round(postCount) || 1));

    const response = await fetch("/api/overstock/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skus,
        postCount: count,
        email: userEmail,
      }),
    });
    const payload = (await response.json()) as {
      data: QueuedOverstockSelection | null;
      error: string | null;
    };

    if (!response.ok || payload.error || !payload.data) {
      throw new Error(payload.error ?? "Failed to queue selection.");
    }

    return payload.data;
  }

  function handleQueue() {
    if (selectedItems.length === 0) {
      return;
    }

    setActionError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const data = await queueSelection();
        setQueued(data);
        setSelected(new Set());
        setSuccessMessage(
          "Queued for the next weekly run. The next weekly run will generate these alongside your regular posts."
        );
        router.refresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Failed to queue selection."
        );
      }
    });
  }

  function handleQueueAndRun() {
    if (selectedItems.length === 0) {
      return;
    }

    setActionError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const data = await queueSelection();
        setQueued(data);
        setSelected(new Set());
        await runNow();
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Failed to queue and start run."
        );
      }
    });
  }

  function handleRunOnly() {
    setActionError(null);
    void runNow();
  }

  function handleCancel() {
    if (!queued) {
      return;
    }

    setActionError(null);
    const id = queued.id;

    startTransition(async () => {
      try {
        const response = await fetch("/api/overstock/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const payload = (await response.json()) as {
          data: unknown;
          error: string | null;
        };

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Failed to cancel batch.");
        }

        setQueued(null);
        setSuccessMessage(null);
        router.refresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Failed to cancel batch."
        );
      }
    });
  }

  function handleRunAnalysis() {
    setActionError(null);
    setSuccessMessage(null);
    setIsAnalyzing(true);

    startTransition(async () => {
      try {
        const response = await fetch("/api/overstock/analyze", {
          method: "POST",
        });
        const payload = (await response.json()) as {
          data: {
            recommendations: OverstockRecommendation[];
            count: number;
          } | null;
          error: string | null;
        };

        if (!response.ok || payload.error || !payload.data) {
          throw new Error(payload.error ?? "Failed to run analysis.");
        }

        setRecommendations(payload.data.recommendations);
        setSuccessMessage(
          payload.data.recommendations.length > 0
            ? `Analysis complete — ${payload.data.recommendations.length} recommendations saved.`
            : "Analysis complete — no eligible recommendations after scoring filters."
        );
        router.refresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Failed to run analysis."
        );
      } finally {
        setIsAnalyzing(false);
      }
    });
  }

  async function handleApproveRecommendation(rec: OverstockRecommendation) {
    if (approvingId || getRecommendationLifecycle(rec) !== "recommended") {
      return;
    }

    setActionError(null);
    setSuccessMessage(null);
    setApprovingId(rec.id);

    try {
      const response = await fetch(
        `/api/overstock/recommendations/${rec.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_count: 1 }),
        }
      );
      const payload = (await response.json()) as {
        data: {
          queuedSelectionId: string;
          recommendation: OverstockRecommendation;
          warning?: string;
        } | null;
        error: string | null;
      };

      if (response.status === 409) {
        toast.error(
          payload.error ??
            "This recommendation is already approved or queued."
        );
        setRecommendations((prev) =>
          prev.map((row) =>
            row.id === rec.id
              ? {
                  ...row,
                  status: "approved",
                }
              : row
          )
        );
        router.refresh();
        return;
      }

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(
          payload.error ?? "Failed to approve recommendation."
        );
      }

      const { recommendation: approved, warning } = payload.data;
      setRecommendations((prev) =>
        prev.map((row) =>
          row.id === rec.id
            ? {
                ...row,
                ...approved,
                status: "approved",
                consumed_by_run_id: approved.consumed_by_run_id ?? null,
              }
            : row
        )
      );

      toast.success("Approved — will generate in the next run.");
      if (warning) {
        toast.warning(
          "Note: another queued selection will be superseded by this one."
        );
        setSuccessMessage(
          `Approved — will generate in the next run. Note: ${warning}`
        );
      } else {
        setSuccessMessage("Approved — will generate in the next run.");
      }
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to approve recommendation.";
      setActionError(message);
      toast.error(message);
    } finally {
      setApprovingId(null);
    }
  }

  const primaryRecommendations = recommendations.filter(
    (row) => row.eligibility_status !== "alternate"
  );
  const displayRecommendations =
    primaryRecommendations.length > 0
      ? primaryRecommendations
      : recommendations;
  const analysisGeneratedAt =
    recommendations[0]?.analysis_generated_at ?? null;

  return (
    <div className="-mx-4 min-h-full bg-[#F3F4F6] px-4 py-2 lg:-mx-8 lg:px-8">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#111111]">Overstock</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Select excess inventory to feature in the next content run.
          </p>
        </div>

        <Card className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#111111]">
                Recommended campaigns
              </h3>
              <p className="mt-1 text-sm text-[#6B7280]">
                Approve a campaign strategy to generate overstock posts in the
                next content run. Creative still goes through Approval → Gate 1.
                {analysisGeneratedAt ? (
                  <>
                    {" "}
                    Last analysis{" "}
                    <time dateTime={analysisGeneratedAt} suppressHydrationWarning>
                      {new Date(analysisGeneratedAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    .
                  </>
                ) : null}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleRunAnalysis}
              disabled={actionsBusy || isAnalyzing}
              className="bg-[#CC2B2B] text-white hover:bg-[#B02424]"
            >
              {isAnalyzing ? "Analyzing…" : "Run analysis"}
            </Button>
          </div>

          {displayRecommendations.length === 0 ? (
            <p className="mt-4 text-sm text-[#6B7280]">
              No scored recommendations yet. Run analysis to generate a ranked
              shortlist.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
              {displayRecommendations.map((rec) => {
                const excessValue = snapshotNumber(
                  rec.inventory_snapshot,
                  "excess_value_local"
                );
                const monthsOfCover = snapshotNumber(
                  rec.inventory_snapshot,
                  "months_of_cover"
                );
                const sku = rec.skus[0] ?? "—";
                const lifecycle = getRecommendationLifecycle(rec);
                const isApproving = approvingId === rec.id;

                return (
                  <li
                    key={rec.id}
                    className="flex flex-wrap items-start gap-3 px-4 py-3"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fdf2f2] text-xs font-semibold text-[#CC2B2B]">
                      #{rec.rank}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="font-medium text-[#111111]">
                          {rec.product_name || rec.product_group}
                        </p>
                        <p className="font-mono text-xs text-[#6B7280]">
                          {sku}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {rec.product_group}
                        </p>
                        {lifecycle === "queued" ? (
                          <span className="inline-flex items-center rounded-md bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#B45309] ring-1 ring-inset ring-[#FDE68A]">
                            Approved — queued for next run
                          </span>
                        ) : null}
                        {lifecycle === "generated" ? (
                          <span className="inline-flex items-center rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#047857] ring-1 ring-inset ring-[#A7F3D0]">
                            Content generated
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-[#374151]">
                        {rec.selection_reason || "—"}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        Score{" "}
                        <span className="font-semibold tabular-nums text-[#111111]">
                          {Math.round(rec.opportunity_score)}
                        </span>
                        {excessValue !== null ? (
                          <>
                            {" "}
                            · Excess {formatCurrencyJMD(excessValue)}
                          </>
                        ) : null}
                        {monthsOfCover !== null ? (
                          <>
                            {" "}
                            · {monthsOfCover.toFixed(1)} mo cover
                          </>
                        ) : null}
                      </p>
                      {rec.ai_review ? (
                        <div className="mt-2 space-y-1.5 rounded-lg border border-[#FECACA]/60 bg-[#fdf2f2]/50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#CC2B2B]">
                            AI review
                          </p>
                          <p className="text-sm text-[#374151]">
                            {rec.ai_review.narrative}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            <span className="font-medium text-[#111111]">
                              Angle:
                            </span>{" "}
                            {rec.ai_review.campaign_angle}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            <span className="font-medium text-[#111111]">
                              Audience:
                            </span>{" "}
                            {rec.ai_review.target_audience}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            <span className="font-medium text-[#111111]">
                              Solves:
                            </span>{" "}
                            {rec.ai_review.customer_problem}
                          </p>
                          {!rec.ai_review.advertisable ? (
                            <p className="text-xs text-[#9CA3AF]">
                              AI flag: limited advertising fit
                              {rec.ai_review.notes
                                ? ` — ${rec.ai_review.notes}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 space-y-1.5">
                        {lifecycle === "recommended" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                void handleApproveRecommendation(rec)
                              }
                              disabled={actionsBusy}
                              className="bg-[#CC2B2B] text-white hover:bg-[#B02424]"
                            >
                              {isApproving
                                ? "Approving…"
                                : "Approve & generate"}
                            </Button>
                            <p className="text-xs text-[#9CA3AF]">
                              Approved recommendations generate posts in the
                              next content run. Review the generated creative
                              in{" "}
                              <Link
                                href={approveHref}
                                className="font-medium text-[#6B7280] underline-offset-2 hover:underline"
                              >
                                Approval → Gate 1
                              </Link>
                              .
                            </p>
                          </>
                        ) : null}
                        {lifecycle === "queued" ? (
                          <p className="text-xs text-[#6B7280]">
                            Waiting for the next content run.{" "}
                            <Link
                              href={approveHref}
                              className="font-medium text-[#CC2B2B] underline-offset-2 hover:underline"
                            >
                              Open Approval
                            </Link>
                          </p>
                        ) : null}
                        {lifecycle === "generated" ? (
                          <p className="text-xs text-[#6B7280]">
                            <Link
                              href={approveHref}
                              className="font-medium text-[#047857] underline-offset-2 hover:underline"
                            >
                              View in Approval → Gate 1
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {queued ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
            <div className="min-w-0 space-y-1">
              <p>
                <span className="font-semibold">{queued.post_count}</span> posts
                across{" "}
                <span className="font-semibold">{queued.skus.length}</span> items
                queued for the next run
              </p>
              {!runWouldFeatureOverstock ? (
                <p className="text-xs text-[#6B7280]">
                  This week&apos;s content is already generated. Queued overstock
                  will feature in next week&apos;s run.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {runWouldFeatureOverstock && runActionMode === "run_only" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRunOnly}
                  disabled={actionsBusy}
                  className="bg-[#CC2B2B] text-white hover:bg-[#B02424]"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  {running ? "Starting..." : "Run now"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={actionsBusy}
                className="border-[#F59E0B]/40 bg-white text-[#B45309] hover:bg-[#FFFBEB]"
              >
                Cancel batch
              </Button>
            </div>
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#15803D]"
          >
            {successMessage}
          </div>
        ) : null}

        {actionError ? (
          <div
            role="alert"
            className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]"
          >
            {actionError}
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]"
          >
            Could not load overstock data: {loadError}
          </div>
        ) : null}

        {items.length === 0 && !loadError ? (
          <Card className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf2f2]">
              <Package className="h-6 w-6 text-[#CC2B2B]" />
            </div>
            <p className="text-sm text-[#6B7280]">
              No overstocked items right now.
            </p>
          </Card>
        ) : items.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
                <input
                  type="checkbox"
                  checked={onlyOver12}
                  onChange={(event) => setOnlyOver12(event.target.checked)}
                  className="h-4 w-4 rounded border-[#D1D5DB] text-[#CC2B2B] focus:ring-[#CC2B2B]/20"
                />
                Only show over 12 months of cover
              </label>
              <p className="text-sm text-[#6B7280]">
                {formatNumber(visibleItems.length)} items
              </p>
            </div>

            {selectedItems.length > 0 ? (
              <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-lg sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#111111]">
                    {selectedItems.length} items selected
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    Combined excess{" "}
                    <span className="font-semibold text-[#111111]">
                      {formatCurrencyJMD(selectedExcessValue)}
                    </span>
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-[#374151]">
                  <span className="whitespace-nowrap">Posts for this batch</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={postCount}
                    onChange={(event) =>
                      setPostCount(Number(event.target.value) || 1)
                    }
                    className="h-9 w-16 rounded-lg border border-[#E5E7EB] bg-white px-2 text-center tabular-nums text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/20"
                  />
                </label>
                <Button
                  type="button"
                  onClick={handleQueue}
                  disabled={actionsBusy}
                  className="bg-[#CC2B2B] text-white hover:bg-[#B02424]"
                >
                  {isPending && !running ? "Queuing…" : "Queue for next run"}
                </Button>
                {runWouldFeatureOverstock &&
                runActionMode === "queue_and_run" ? (
                  <Button
                    type="button"
                    onClick={handleQueueAndRun}
                    disabled={actionsBusy}
                    className="bg-[#CC2B2B] text-white hover:bg-[#B02424]"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden />
                    {running ? "Starting..." : "Queue & run now"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Card className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-0 shadow-sm">
              {visibleItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-[#6B7280]">
                  No items match the current filter.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all visible rows"
                          className="h-4 w-4 rounded border-[#D1D5DB] text-[#CC2B2B] focus:ring-[#CC2B2B]/20"
                        />
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product name</TableHead>
                      <TableHead className="text-right">Qty available</TableHead>
                      <TableHead className="text-center">
                        Months of cover
                      </TableHead>
                      <TableHead className="text-right">Excess units</TableHead>
                      <TableHead className="text-right">
                        Excess value J$
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => {
                      const isSelected = selected.has(item.sku);
                      return (
                        <TableRow
                          key={item.sku}
                          data-state={isSelected ? "selected" : undefined}
                          className={cn(
                            isSelected && "bg-[#fdf2f2]/70 hover:bg-[#fdf2f2]"
                          )}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSku(item.sku)}
                              aria-label={`Select ${item.sku}`}
                              className="h-4 w-4 rounded border-[#D1D5DB] text-[#CC2B2B] focus:ring-[#CC2B2B]/20"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold text-[#111111]">
                            {item.sku}
                          </TableCell>
                          <TableCell className="max-w-[280px] whitespace-normal break-words text-sm text-[#374151]">
                            {item.product_name || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(item.quantity_available)}
                          </TableCell>
                          <TableCell className="text-center">
                            <CoverBadge months={item.months_of_cover} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(item.excess_units)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-[#111111]">
                            {formatCurrencyJMD(item.excess_value_local)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
