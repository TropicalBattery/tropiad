"use client";

import { CheckCheck } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApprovalCycleSelector } from "@/components/dashboard/ApprovalCycleSelector";
import { CycleStatus } from "@/components/dashboard/CycleStatus";
import { Gate1Queue } from "@/components/dashboard/Gate1Queue";
import { Gate2Queue } from "@/components/dashboard/Gate2Queue";
import { ProductionCard } from "@/components/dashboard/ProductionCard";
import { ProductionQueue } from "@/components/dashboard/ProductionQueue";
import { RejectionFeedbackModal } from "@/components/dashboard/RejectionFeedbackModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALL_PENDING_RUN_VALUE,
  approvalTabToQuery,
  buildApprovalCycleOptions,
  buildCycleSummary,
  filterPostsForRunSelection,
  formatGroupHeadingMeta,
  formatWeekOfLabel,
  groupPostsByCycle,
  olderUnresolvedPendingCount,
  oldestUnresolvedRunId,
  resolveApprovalTab,
  resolveRunSelection,
  uniqueCycleCountForPosts,
  type ApprovalQueueTab,
} from "@/lib/approvals/approval-cycles";
import { isGate2Pending } from "@/lib/approvals/approval-cycles";
import type { RejectionGate } from "@/lib/constants/rejection-reasons";
import { createClient } from "@/lib/supabase/client";
import type {
  BrandConfig,
  Company,
  ContentRun,
  Cycle,
  Post,
} from "@/lib/supabase/types";
import { getWeekRangeLabel, getWeekStartIso } from "@/lib/utils/dashboard";

type RejectionTarget = {
  post: Post;
  gate: RejectionGate;
};

type BulkConfirmState = {
  gate: 1 | 2;
  postIds: string[];
};

type ApprovalDashboardProps = {
  embedded?: boolean;
  initialTab?: ApprovalQueueTab | "concepts" | "posts";
  initialRun?: string | null;
  initialCompany: Company;
  initialBrandConfig: BrandConfig | null;
  initialPosts: Post[];
  initialContentRuns: Pick<ContentRun, "id" | "week_start" | "status">[];
  initialCycle: Cycle | null;
};

export function ApprovalDashboard({
  embedded = false,
  initialTab,
  initialRun = null,
  initialCompany,
  initialPosts,
  initialContentRuns,
  initialCycle,
}: ApprovalDashboardProps) {
  const [company] = useState<Company>(initialCompany);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [contentRuns, setContentRuns] = useState(initialContentRuns);
  const [cycle] = useState<Cycle | null>(initialCycle);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<ApprovalQueueTab>(() =>
    resolveApprovalTab(
      typeof initialTab === "string" ? initialTab : undefined
    )
  );
  const [rejectionTarget, setRejectionTarget] = useState<RejectionTarget | null>(
    null
  );
  const [isRejecting, setIsRejecting] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirmState | null>(null);
  const notifiedReadyRef = useRef<Set<string>>(new Set());
  const refreshInFlightRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const weekRange = useMemo(() => getWeekRangeLabel(), []);
  const currentWeekStart = useMemo(() => getWeekStartIso(), []);

  const cycleOptions = useMemo(
    () => buildApprovalCycleOptions(posts, contentRuns, currentWeekStart),
    [posts, contentRuns, currentWeekStart]
  );

  const urlRun = searchParams.get("run") ?? initialRun;
  const selectedRun = useMemo(
    () => resolveRunSelection(cycleOptions, urlRun),
    [cycleOptions, urlRun]
  );

  const writeQueueParams = useCallback(
    (runValue: string, tabValue: ApprovalQueueTab) => {
      const params = new URLSearchParams();
      params.set("run", runValue);
      params.set("tab", approvalTabToQuery(tabValue));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    const tabFromUrl = resolveApprovalTab(searchParams.get("tab"));
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (cycleOptions.length === 0) {
      return;
    }

    const urlIsValid =
      urlRun === ALL_PENDING_RUN_VALUE ||
      (Boolean(urlRun) &&
        cycleOptions.some((option) => option.runId === urlRun));

    if (!urlIsValid) {
      writeQueueParams(selectedRun, activeTab);
    }
  }, [cycleOptions, urlRun, selectedRun, activeTab, writeQueueParams]);

  function handleCycleChange(value: string) {
    writeQueueParams(value, activeTab);
  }

  function handleTabChange(value: string) {
    const nextTab = resolveApprovalTab(value);
    setActiveTab(nextTab);
    writeQueueParams(selectedRun, nextTab);
  }

  const gate1Posts = useMemo(
    () => filterPostsForRunSelection(posts, selectedRun, "gate1"),
    [posts, selectedRun]
  );

  const gate2Posts = useMemo(
    () => filterPostsForRunSelection(posts, selectedRun, "gate2"),
    [posts, selectedRun]
  );

  const productionPosts = useMemo(
    () => filterPostsForRunSelection(posts, selectedRun, "production"),
    [posts, selectedRun]
  );

  const gate1Groups = useMemo(
    () =>
      selectedRun === ALL_PENDING_RUN_VALUE
        ? groupPostsByCycle(gate1Posts, cycleOptions)
        : [],
    [selectedRun, gate1Posts, cycleOptions]
  );

  const gate2Groups = useMemo(
    () =>
      selectedRun === ALL_PENDING_RUN_VALUE
        ? groupPostsByCycle(gate2Posts, cycleOptions)
        : [],
    [selectedRun, gate2Posts, cycleOptions]
  );

  const productionGroups = useMemo(
    () =>
      selectedRun === ALL_PENDING_RUN_VALUE
        ? groupPostsByCycle(productionPosts, cycleOptions)
        : [],
    [selectedRun, productionPosts, cycleOptions]
  );

  const gate1Orphans = useMemo(
    () =>
      selectedRun === ALL_PENDING_RUN_VALUE
        ? gate1Posts.filter((post) => !post.run_id)
        : [],
    [selectedRun, gate1Posts]
  );

  const gate2Orphans = useMemo(
    () =>
      selectedRun === ALL_PENDING_RUN_VALUE
        ? gate2Posts.filter((post) => !post.run_id)
        : [],
    [selectedRun, gate2Posts]
  );

  const productionOrphans = useMemo(
    () =>
      selectedRun === ALL_PENDING_RUN_VALUE
        ? productionPosts.filter((post) => !post.run_id)
        : [],
    [selectedRun, productionPosts]
  );

  const weekStartByRunId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const run of contentRuns) {
      map[run.id] = run.week_start;
    }
    for (const option of cycleOptions) {
      map[option.runId] = option.weekStart;
    }
    return map;
  }, [contentRuns, cycleOptions]);

  const olderPendingCount = useMemo(
    () => olderUnresolvedPendingCount(cycleOptions, selectedRun),
    [cycleOptions, selectedRun]
  );

  const summary = useMemo(
    () =>
      buildCycleSummary({
        selection: selectedRun,
        options: cycleOptions,
        gate: activeTab,
        visibleGateCount:
          activeTab === "gate2"
            ? gate2Posts.length
            : activeTab === "production"
              ? productionPosts.length
              : gate1Posts.length,
      }),
    [
      selectedRun,
      cycleOptions,
      activeTab,
      gate1Posts.length,
      gate2Posts.length,
      productionPosts.length,
    ]
  );

  const isAllPending = selectedRun === ALL_PENDING_RUN_VALUE;
  const approveAllLabel = isAllPending ? "Approve all visible" : "Approve all";

  const refreshQueue = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch(
        `/api/dashboard/${company.slug}/approval-queue`,
        { method: "GET", cache: "no-store" }
      );
      const payload = (await response.json()) as {
        data: {
          posts: Post[];
          contentRuns: Pick<ContentRun, "id" | "week_start" | "status">[];
        } | null;
        error: string | null;
      };

      if (!response.ok || payload.error || !payload.data) {
        setRefreshError(
          payload.error ?? "Production statuses could not be loaded."
        );
        return;
      }

      setPosts((previous) => {
        const previousReadyIds = new Set(
          previous.filter(isGate2Pending).map((post) => post.id)
        );
        const nextPosts = payload.data!.posts;
        const newlyReady = nextPosts.filter(
          (post) =>
            isGate2Pending(post) &&
            !previousReadyIds.has(post.id) &&
            !notifiedReadyRef.current.has(post.id)
        );

        if (newlyReady.length > 0) {
          for (const post of newlyReady) {
            notifiedReadyRef.current.add(post.id);
          }
          toast.success(
            newlyReady.length === 1
              ? "1 post is now ready for final approval."
              : `${newlyReady.length} posts are now ready for final approval.`
          );
        }

        return nextPosts;
      });
      setContentRuns(payload.data.contentRuns);
    } catch {
      setRefreshError("Production statuses could not be loaded.");
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [company.slug]);

  useEffect(() => {
    if (activeTab !== "production") {
      return;
    }

    const hasActiveProduction = productionPosts.some(
      (post) =>
        post.pipeline_stage !== "failed" &&
        post.pipeline_stage !== "awaiting_connection"
    );

    if (!hasActiveProduction) {
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }
      void refreshQueue();
    };

    const intervalId = window.setInterval(tick, 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTab, productionPosts, refreshQueue]);

  async function handleRetryProduction(postId: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/posts/${postId}/retry-production`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        data: { post: Post; message?: string } | null;
        error: string | null;
      };

      if (!response.ok || payload.error || !payload.data) {
        toast.error(payload.error ?? "Failed to retry production.");
        return;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, ...payload.data!.post } : post
        )
      );
      toast.success(payload.data.message ?? "Production retry started.");
      void refreshQueue();
    } finally {
      setIsUpdating(false);
    }
  }

  type ApiPayload = {
    data: unknown;
    error: string | null;
  };

  async function approvePostViaApi(
    postId: string,
    gate: 1 | 2,
    rollbackPosts: Post[],
    options?: { publishNow?: boolean }
  ): Promise<boolean> {
    const response = await fetch(`/api/posts/${postId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gate,
        ...(options?.publishNow ? { publishNow: true } : {}),
      }),
    });

    const payload = (await response.json()) as ApiPayload;

    if (!response.ok || payload.error) {
      setPosts(rollbackPosts);
      toast.error(payload.error ?? "Failed to approve.");
      return false;
    }

    return true;
  }

  async function applyPostUpdate(
    postId: string,
    updates: Partial<Post>,
    rollbackPosts: Post[]
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", postId);

    if (error) {
      setPosts(rollbackPosts);
      toast.error(error.message);
      throw error;
    }
  }

  function removePostIfNotPending(postId: string, updates: Partial<Post>) {
    setPosts((current) =>
      current
        .map((post) => (post.id === postId ? { ...post, ...updates } : post))
        .filter(
          (post) =>
            post.gate1_status === "pending" || post.gate2_status === "pending"
        )
    );
  }

  function openRejectionModal(post: Post, gate: RejectionGate) {
    setRejectionTarget({ post, gate });
  }

  async function handleRejectionConfirm(reasons: string[], freeText: string) {
    if (!rejectionTarget) {
      return;
    }

    const { post, gate } = rejectionTarget;
    const rollbackPosts = posts;
    const now = new Date().toISOString();
    const updates =
      gate === "gate1"
        ? {
            gate1_status: "rejected",
            pipeline_stage: "rejected",
            gate1_reviewed_at: now,
          }
        : {
            gate2_status: "rejected",
            pipeline_stage: "rejected",
            gate2_reviewed_at: now,
          };

    removePostIfNotPending(post.id, updates);
    setIsRejecting(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gate,
          reasons,
          freeText,
        }),
      });

      const payload = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        setPosts(rollbackPosts);
        toast.error(payload.error ?? "Failed to submit rejection.");
        return;
      }

      setRejectionTarget(null);
      toast.success("Feedback received");
    } finally {
      setIsRejecting(false);
    }
  }

  async function handleGate1Approve(postId: string) {
    const rollbackPosts = posts;
    const now = new Date().toISOString();
    const updates = {
      gate1_status: "approved",
      pipeline_stage: "ideation",
      gate1_reviewed_at: now,
    };

    removePostIfNotPending(postId, updates);
    setIsUpdating(true);

    try {
      const approved = await approvePostViaApi(postId, 1, rollbackPosts);
      if (approved) {
        toast.success("Concept approved.");
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleGate1EditSave(postId: string, concept: string) {
    const rollbackPosts = posts;
    const now = new Date().toISOString();
    const updates = {
      concept,
      gate1_status: "approved",
      pipeline_stage: "ideation",
      gate1_reviewed_at: now,
    };

    removePostIfNotPending(postId, updates);
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/posts/${postId}/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gate: 1,
          content: concept,
        }),
      });

      const payload = (await response.json()) as ApiPayload;

      if (!response.ok || payload.error) {
        setPosts(rollbackPosts);
        toast.error(payload.error ?? "Failed to update concept.");
        return;
      }

      toast.success("Concept updated and approved.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function runBulkApprove(gate: 1 | 2, postIds: string[]) {
    if (postIds.length === 0) {
      return;
    }

    const rollbackPosts = posts;
    const now = new Date().toISOString();
    const idSet = new Set(postIds);

    setPosts((current) =>
      current
        .map((post) =>
          idSet.has(post.id)
            ? gate === 1
              ? {
                  ...post,
                  gate1_status: "approved",
                  pipeline_stage: "ideation",
                  gate1_reviewed_at: now,
                }
              : {
                  ...post,
                  gate2_status: "approved",
                  gate2_reviewed_at: now,
                }
            : post
        )
        .filter(
          (post) =>
            post.gate1_status === "pending" || post.gate2_status === "pending"
        )
    );

    setIsUpdating(true);
    setIsApprovingAll(true);

    const failedIds: string[] = [];

    try {
      for (const postId of postIds) {
        const approved = await approvePostViaApi(postId, gate, rollbackPosts);
        if (!approved) {
          failedIds.push(postId);
          break;
        }
      }

      if (failedIds.length > 0) {
        toast.error(
          `Stopped after failures. ${failedIds.length} post(s) could not be approved.`
        );
      } else {
        toast.success(
          gate === 1
            ? `Approved ${postIds.length} concepts.`
            : `Approved ${postIds.length} posts.`
        );
      }

      router.refresh();
    } finally {
      setIsUpdating(false);
      setIsApprovingAll(false);
      setBulkConfirm(null);
    }
  }

  function requestBulkApprove(gate: 1 | 2) {
    const visible = gate === 1 ? gate1Posts : gate2Posts;
    const ids = visible.map((post) => post.id);
    if (ids.length === 0) {
      return;
    }

    if (isAllPending) {
      setBulkConfirm({ gate, postIds: ids });
      return;
    }

    void runBulkApprove(gate, ids);
  }

  async function handleGate2Approve(postId: string) {
    const rollbackPosts = posts;
    const now = new Date().toISOString();
    const updates = {
      gate2_status: "approved",
      gate2_reviewed_at: now,
    };

    removePostIfNotPending(postId, updates);
    setIsUpdating(true);

    try {
      const approved = await approvePostViaApi(postId, 2, rollbackPosts);
      if (approved) {
        toast.success("Post approved and queued for publishing.");
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleGate2PublishNow(postId: string) {
    const rollbackPosts = posts;
    const now = new Date().toISOString();
    const updates = {
      gate2_status: "approved",
      gate2_reviewed_at: now,
      scheduled_at: now,
    };

    removePostIfNotPending(postId, updates);
    setIsUpdating(true);

    try {
      const approved = await approvePostViaApi(postId, 2, rollbackPosts, {
        publishNow: true,
      });
      if (approved) {
        toast.success("Post published now.");
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleGate2RequestEdit(postId: string, feedback: string) {
    const rollbackPosts = posts;
    const updates = {
      gate2_status: "edit_requested",
      edit_feedback: feedback,
      gate2_reviewed_at: new Date().toISOString(),
    };

    removePostIfNotPending(postId, updates);
    setIsUpdating(true);

    try {
      await applyPostUpdate(postId, updates, rollbackPosts);
      toast.success("Edit request submitted.");
    } finally {
      setIsUpdating(false);
    }
  }

  const bulkCycleCount = bulkConfirm
    ? uniqueCycleCountForPosts(
        (bulkConfirm.gate === 1 ? gate1Posts : gate2Posts).filter((post) =>
          bulkConfirm.postIds.includes(post.id)
        ),
        cycleOptions
      )
    : 0;

  const noApprovalsAtAll = cycleOptions.length === 0;

  const content = (
    <div className="space-y-6">
      {!embedded && (
        <CycleStatus
          cycle={cycle}
          gate1Pending={gate1Posts.length}
          gate2Pending={gate2Posts.length}
        />
      )}

      {noApprovalsAtAll ? (
        <div className="surface-card border border-dashed border-border-subtle px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold text-text-primary">
            There is currently no content awaiting approval.
          </p>
        </div>
      ) : (
        <>
          <ApprovalCycleSelector
            options={cycleOptions}
            value={selectedRun}
            onChange={handleCycleChange}
          />

          {summary ? (
            <p className="text-sm text-text-muted">{summary}</p>
          ) : null}

          {olderPendingCount > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-surface-hover px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-text-primary">
                An earlier content cycle still has {olderPendingCount} post
                {olderPendingCount === 1 ? "" : "s"} awaiting approval.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  const oldest = oldestUnresolvedRunId(cycleOptions);
                  if (oldest) {
                    handleCycleChange(oldest);
                  }
                }}
              >
                Review older content
              </Button>
            </div>
          )}

          {refreshError ? (
            <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-rose-700">{refreshError}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshQueue()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto sm:w-auto">
              <TabsTrigger value="gate1" className="shrink-0">
                <span>New ideas</span>
                <span className="status-pill status-pill-neutral">GATE 1</span>
                {gate1Posts.length > 0 && (
                  <Badge variant="default">{gate1Posts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="production" className="shrink-0">
                <span>In production</span>
                <span className="status-pill status-pill-neutral">
                  PRODUCTION
                </span>
                {productionPosts.length > 0 && (
                  <Badge variant="secondary">{productionPosts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="gate2" className="shrink-0">
                <span>Ready to publish</span>
                <span className="status-pill status-pill-success">GATE 2</span>
                {gate2Posts.length > 0 && (
                  <Badge variant="success">{gate2Posts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gate1">
              {isAllPending ? (
                <div className="space-y-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-text-muted">
                      {gate1Posts.length} concept
                      {gate1Posts.length === 1 ? "" : "s"} awaiting approval
                    </p>
                    {gate1Posts.length > 0 && (
                      <Button
                        type="button"
                        disabled={isUpdating || isApprovingAll}
                        onClick={() => requestBulkApprove(1)}
                      >
                        {approveAllLabel}
                      </Button>
                    )}
                  </div>
                  {gate1Groups.map((group) => (
                    <div key={group.option.runId} className="space-y-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          {formatWeekOfLabel(group.option.weekStart)}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {formatGroupHeadingMeta(group.option)}
                        </p>
                      </div>
                      <Gate1Queue
                        posts={group.posts}
                        isUpdating={isUpdating || isApprovingAll}
                        showBulkApprove={false}
                        awaitingLabel={`${group.posts.length} concept${group.posts.length === 1 ? "" : "s"} awaiting approval`}
                        onApprove={handleGate1Approve}
                        onReject={(post) => openRejectionModal(post, "gate1")}
                        onEditSave={handleGate1EditSave}
                        onBulkApprove={async () => undefined}
                      />
                    </div>
                  ))}
                  {gate1Orphans.length > 0 && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          Other pending
                        </h3>
                        <p className="text-sm text-text-muted">
                          Not linked to a content cycle
                        </p>
                      </div>
                      <Gate1Queue
                        posts={gate1Orphans}
                        isUpdating={isUpdating || isApprovingAll}
                        showBulkApprove={false}
                        awaitingLabel={`${gate1Orphans.length} concept${gate1Orphans.length === 1 ? "" : "s"} awaiting approval`}
                        onApprove={handleGate1Approve}
                        onReject={(post) => openRejectionModal(post, "gate1")}
                        onEditSave={handleGate1EditSave}
                        onBulkApprove={async () => undefined}
                      />
                    </div>
                  )}
                  {gate1Posts.length === 0 && (
                    <Gate1Queue
                      posts={[]}
                      isUpdating={isUpdating}
                      showBulkApprove={false}
                      emptyTitle="No new ideas are awaiting approval for this cycle."
                      onApprove={handleGate1Approve}
                      onReject={(post) => openRejectionModal(post, "gate1")}
                      onEditSave={handleGate1EditSave}
                      onBulkApprove={async () => undefined}
                    />
                  )}
                </div>
              ) : (
                <Gate1Queue
                  posts={gate1Posts}
                  isUpdating={isUpdating || isApprovingAll}
                  approveAllLabel={approveAllLabel}
                  emptyTitle="No new ideas are awaiting approval for this cycle."
                  onApprove={handleGate1Approve}
                  onReject={(post) => openRejectionModal(post, "gate1")}
                  onEditSave={handleGate1EditSave}
                  onBulkApprove={async () => requestBulkApprove(1)}
                />
              )}
            </TabsContent>

            <TabsContent value="production">
              {isAllPending ? (
                <div className="space-y-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-text-muted">
                        {productionPosts.length} posts in production across{" "}
                        {
                          cycleOptions.filter((o) => o.productionCount > 0)
                            .length
                        }{" "}
                        cycles
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isRefreshing}
                      onClick={() => void refreshQueue()}
                    >
                      Refresh
                    </Button>
                  </div>
                  {productionPosts.length === 0 ? (
                    <div className="surface-card border border-dashed border-border-subtle px-6 py-16 text-center">
                      <p className="font-display text-lg font-semibold text-text-primary">
                        There are currently no approved concepts being produced.
                      </p>
                    </div>
                  ) : null}
                  {productionGroups.map((group) => (
                    <div key={group.option.runId} className="space-y-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          {formatWeekOfLabel(group.option.weekStart)}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {formatGroupHeadingMeta(group.option)}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 justify-items-start gap-3 min-[640px]:grid-cols-[repeat(auto-fit,minmax(260px,360px))]">
                        {group.posts.map((post) => (
                          <ProductionCard
                            key={post.id}
                            post={post}
                            weekStart={group.option.weekStart}
                            companySlug={company.slug}
                            disabled={isUpdating}
                            onRetry={handleRetryProduction}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {productionOrphans.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-display text-base font-semibold text-text-primary">
                        Other pending
                      </h3>
                      <div className="grid grid-cols-1 justify-items-start gap-3 min-[640px]:grid-cols-[repeat(auto-fit,minmax(260px,360px))]">
                        {productionOrphans.map((post) => (
                          <ProductionCard
                            key={post.id}
                            post={post}
                            weekStart={null}
                            companySlug={company.slug}
                            disabled={isUpdating}
                            onRetry={handleRetryProduction}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ProductionQueue
                  posts={productionPosts}
                  weekStartByRunId={weekStartByRunId}
                  companySlug={company.slug}
                  isUpdating={isUpdating}
                  isRefreshing={isRefreshing}
                  summaryLabel={
                    summary ??
                    `${productionPosts.length} posts in production`
                  }
                  emptyTitle="No posts are currently in production for this cycle."
                  emptyDescription="All approved concepts from this cycle have finished production."
                  gate2Count={gate2Posts.length}
                  onRetry={handleRetryProduction}
                  onRefresh={() => void refreshQueue()}
                  onViewReady={() => handleTabChange("gate2")}
                />
              )}
            </TabsContent>

            <TabsContent value="gate2">
              {gate2Posts.length > 0 && (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => requestBulkApprove(2)}
                    disabled={isApprovingAll || isUpdating}
                    className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-[#111111] dark:text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    <CheckCheck size={15} />
                    {isApprovingAll
                      ? "Approving..."
                      : `${approveAllLabel} (${gate2Posts.length})`}
                  </button>
                </div>
              )}

              {isAllPending ? (
                <div className="space-y-8">
                  {gate2Groups.map((group) => (
                    <div key={group.option.runId} className="space-y-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          {formatWeekOfLabel(group.option.weekStart)}
                        </h3>
                        <p className="text-sm text-text-muted">
                          {formatGroupHeadingMeta(group.option)}
                        </p>
                      </div>
                      <Gate2Queue
                        posts={group.posts}
                        companyName={company.name}
                        isUpdating={isUpdating || isApprovingAll}
                        onApprove={handleGate2Approve}
                        onPublishNow={handleGate2PublishNow}
                        onReject={(post) => openRejectionModal(post, "gate2")}
                        onRequestEdit={handleGate2RequestEdit}
                      />
                    </div>
                  ))}
                  {gate2Orphans.length > 0 && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          Other pending
                        </h3>
                        <p className="text-sm text-text-muted">
                          Not linked to a content cycle
                        </p>
                      </div>
                      <Gate2Queue
                        posts={gate2Orphans}
                        companyName={company.name}
                        isUpdating={isUpdating || isApprovingAll}
                        onApprove={handleGate2Approve}
                        onPublishNow={handleGate2PublishNow}
                        onReject={(post) => openRejectionModal(post, "gate2")}
                        onRequestEdit={handleGate2RequestEdit}
                      />
                    </div>
                  )}
                  {gate2Posts.length === 0 && (
                    <Gate2Queue
                      posts={[]}
                      companyName={company.name}
                      isUpdating={isUpdating}
                      emptyTitle="No posts are ready for final approval in this cycle."
                      onApprove={handleGate2Approve}
                      onPublishNow={handleGate2PublishNow}
                      onReject={(post) => openRejectionModal(post, "gate2")}
                      onRequestEdit={handleGate2RequestEdit}
                    />
                  )}
                </div>
              ) : (
                <Gate2Queue
                  posts={gate2Posts}
                  companyName={company.name}
                  isUpdating={isUpdating || isApprovingAll}
                  emptyTitle="No posts are ready for final approval in this cycle."
                  onApprove={handleGate2Approve}
                  onPublishNow={handleGate2PublishNow}
                  onReject={(post) => openRejectionModal(post, "gate2")}
                  onRequestEdit={handleGate2RequestEdit}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <RejectionFeedbackModal
        open={rejectionTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectionTarget(null);
          }
        }}
        gate={rejectionTarget?.gate ?? "gate1"}
        hasVisual={
          Boolean(
            rejectionTarget?.post.image_url || rejectionTarget?.post.video_url
          )
        }
        isSubmitting={isRejecting}
        onConfirm={handleRejectionConfirm}
      />

      <AlertDialog
        open={bulkConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve all visible?</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve {bulkConfirm?.postIds.length ?? 0}{" "}
              {bulkConfirm?.gate === 1 ? "concept" : "post"}
              {(bulkConfirm?.postIds.length ?? 0) === 1 ? "" : "s"} across{" "}
              {bulkCycleCount} cycle{bulkCycleCount === 1 ? "" : "s"} in the
              current gate only. Posts in the other gate will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApprovingAll}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isApprovingAll}
              onClick={(event) => {
                event.preventDefault();
                if (bulkConfirm) {
                  void runBulkApprove(bulkConfirm.gate, bulkConfirm.postIds);
                }
              }}
            >
              {isApprovingAll ? "Approving..." : "Approve all visible"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-content-bg">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-navy">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="order-1 sm:order-none">
            <p className="text-lg font-bold tracking-tight text-[#111111] dark:text-white">
              Autopilot
            </p>
          </div>

          <div className="order-3 text-center sm:order-none sm:flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
              Current week
            </p>
            <p className="text-sm font-medium text-[#111111] dark:text-white">
              {weekRange}
            </p>
          </div>

          <div className="order-2 text-left sm:order-none sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-slate-400">
              Client
            </p>
            <p className="text-sm font-medium text-[#111111] dark:text-white">
              {company.name}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {content}
      </main>
    </div>
  );
}
