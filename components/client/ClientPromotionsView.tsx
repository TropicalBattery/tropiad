"use client";

import { Loader2, Megaphone, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { PromotionForm } from "@/components/dashboard/PromotionForm";
import { Button } from "@/components/ui/button";
import type { Promotion } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import {
  formatPromotionDate,
  getTodayIso,
  isPromotionActive,
  isPromotionScheduled,
} from "@/lib/validations/promotions";

type ClientPromotionsViewProps = {
  companyId: string;
  initialPromotions: Promotion[];
  activePlatforms: string[];
};

function normalizePromotions(value: Promotion[] | null | undefined): Promotion[] {
  return Array.isArray(value) ? value : [];
}

export function ClientPromotionsView({
  companyId,
  initialPromotions,
  activePlatforms,
}: ClientPromotionsViewProps) {
  const [promotions, setPromotions] = useState(() =>
    normalizePromotions(initialPromotions)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [expiringId, setExpiringId] = useState<string | null>(null);

  const today = getTodayIso();

  const { activeUpcoming, past } = useMemo(() => {
    const activeUpcomingItems: Promotion[] = [];
    const pastItems: Promotion[] = [];

    for (const promotion of promotions) {
      const isPast =
        promotion.status === "expired" || promotion.end_date < today;

      if (isPast) {
        pastItems.push(promotion);
      } else if (promotion.end_date >= today) {
        activeUpcomingItems.push(promotion);
      }
    }

    return { activeUpcoming: activeUpcomingItems, past: pastItems };
  }, [promotions, today]);

  function handlePromotionCreated(promotion: Promotion) {
    setPromotions((current) =>
      [promotion, ...normalizePromotions(current)].sort((left, right) =>
        right.start_date.localeCompare(left.start_date)
      )
    );
  }

  async function handleMarkExpired(promotionId: string) {
    setExpiringId(promotionId);

    try {
      const response = await fetch(`/api/promotions/${promotionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "expired" }),
      });

      const payload = (await response.json()) as {
        data: Promotion | null;
        error: string | null;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to mark promotion as expired.");
      }

      setPromotions((current) =>
        normalizePromotions(current).map((promotion) =>
          promotion.id === promotionId ? payload.data! : promotion
        )
      );
    } catch (error) {
      console.error(error);
    } finally {
      setExpiringId(null);
    }
  }

  const hasPromotions = promotions.length > 0;

  return (
    <div className="-mx-4 min-h-full bg-[#F3F4F6] dark:bg-[#0a0a0a] px-4 py-2 lg:-mx-8 lg:px-8">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#111111] dark:text-white">Promotions</h2>
            <p className="mt-1 text-[#6b7280] dark:text-slate-400">
              Manage offers and campaigns featured in your content.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setFormOpen(true)}
            className="shrink-0 bg-[#CC2B2B] text-white dark:bg-violet-600 hover:bg-violet-500"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Promotion
          </Button>
        </div>

        {!hasPromotions ? (
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
              <Megaphone className="h-6 w-6 text-violet-400" />
            </div>
            <p className="mx-auto max-w-md text-sm text-[#6b7280] dark:text-slate-400">
              No promotions yet. Create your first promotion to have Autopilot
              feature it in your content.
            </p>
            <Button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-6 bg-[#CC2B2B] text-white dark:bg-violet-600 hover:bg-violet-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Promotion
            </Button>
          </div>
        ) : (
          <>
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                Active &amp; Upcoming
              </h3>

              {activeUpcoming.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {activeUpcoming.map((promotion) => {
                    const active = isPromotionActive(promotion, today);
                    const upcoming = isPromotionScheduled(promotion, today);

                    return (
                      <article
                        key={promotion.id}
                        className={cn(
                          "rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-5",
                          active
                            ? "border-l-4 border-l-emerald-500"
                            : upcoming
                              ? "border-l-4 border-l-violet-500"
                              : ""
                        )}
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              active
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-violet-500/15 text-violet-400"
                            )}
                          >
                            {active ? "Active" : "Upcoming"}
                          </span>
                        </div>

                        <h4 className="text-base font-semibold text-[#111111] dark:text-white">
                          {promotion.title}
                        </h4>

                        {promotion.description ? (
                          <p className="mt-2 text-sm text-[#6b7280] dark:text-slate-400">
                            {promotion.description}
                          </p>
                        ) : null}

                        {promotion.discount_value ? (
                          <p className="mt-2 text-sm text-[#374151] dark:text-slate-300">
                            {promotion.discount_value}
                          </p>
                        ) : null}

                        {promotion.promo_code ? (
                          <p className="mt-1 font-mono text-xs text-violet-400">
                            Code: {promotion.promo_code}
                          </p>
                        ) : null}

                        <p className="mt-3 text-xs text-[#9ca3af] dark:text-slate-500">
                          {formatPromotionDate(promotion.start_date)} &mdash;{" "}
                          {formatPromotionDate(promotion.end_date)}
                        </p>

                        {promotion.platforms.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {promotion.platforms.map((platform) => (
                              <PlatformBadge key={platform} platform={platform} />
                            ))}
                          </div>
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={expiringId === promotion.id}
                          onClick={() => void handleMarkExpired(promotion.id)}
                          className="mt-4 border-[#E5E7EB] dark:border-[#2a2a2a] bg-transparent text-[#6b7280] dark:text-slate-400 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
                        >
                          {expiringId === promotion.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Mark as expired"
                          )}
                        </Button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm text-[#6b7280] dark:text-slate-400">
                  No active or upcoming promotions.
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                Past Promotions
              </h3>

              {past.length > 0 ? (
                <div className="space-y-2">
                  {past.map((promotion) => (
                    <div
                      key={promotion.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616]/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#9ca3af] dark:text-slate-500">
                          {promotion.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {formatPromotionDate(promotion.start_date)} &mdash;{" "}
                          {formatPromotionDate(promotion.end_date)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                        {promotion.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616]/60 p-6 text-sm text-slate-600">
                  No past promotions.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <PromotionForm
        open={formOpen}
        companyId={companyId}
        activePlatforms={activePlatforms}
        onClose={() => setFormOpen(false)}
        onCreated={handlePromotionCreated}
      />
    </div>
  );
}
