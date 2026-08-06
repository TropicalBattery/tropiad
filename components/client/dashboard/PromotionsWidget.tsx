"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { PromotionForm } from "@/components/dashboard/PromotionForm";
import { Button } from "@/components/ui/button";
import type { Promotion } from "@/lib/supabase/types";
import {
  formatPromotionDate,
  getTodayIso,
  isPromotionActive,
  isPromotionScheduled,
} from "@/lib/validations/promotions";

type PromotionsWidgetProps = {
  companyId: string;
  initialPromotions?: Promotion[] | null;
  activePlatforms: string[];
};

function normalizePromotions(value: Promotion[] | null | undefined): Promotion[] {
  return Array.isArray(value) ? value : [];
}

export function PromotionsWidget({
  companyId,
  initialPromotions,
  activePlatforms,
}: PromotionsWidgetProps) {
  const [promotions, setPromotions] = useState(() =>
    normalizePromotions(initialPromotions)
  );
  const [formOpen, setFormOpen] = useState(false);

  const today = getTodayIso();

  const { active, scheduled } = useMemo(() => {
    const activeItems: Promotion[] = [];
    const scheduledItems: Promotion[] = [];
    const items = normalizePromotions(promotions);

    for (const promotion of items) {
      if (isPromotionActive(promotion, today)) {
        activeItems.push(promotion);
      } else if (isPromotionScheduled(promotion, today)) {
        scheduledItems.push(promotion);
      }
    }

    return { active: activeItems, scheduled: scheduledItems };
  }, [promotions, today]);

  function handlePromotionCreated(promotion: Promotion) {
    setPromotions((current) =>
      [...normalizePromotions(current), promotion].sort((left, right) =>
        left.start_date.localeCompare(right.start_date)
      )
    );
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
        Promotions
      </h3>

      <div className="space-y-3">
        {active.map((promotion) => (
          <article
            key={promotion.id}
            className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] border-l-4 border-l-emerald-500 bg-white dark:bg-[#161616] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Active
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[#111111] dark:text-white">{promotion.title}</h4>
            {promotion.description ? (
              <p className="mt-1 line-clamp-1 text-sm text-[#6b7280] dark:text-slate-400">
                {promotion.description}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-[#9ca3af] dark:text-slate-500">
              Until {formatPromotionDate(promotion.end_date)}
            </p>
          </article>
        ))}

        {scheduled.map((promotion) => (
          <article
            key={promotion.id}
            className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] border-l-4 border-l-violet-500 bg-white dark:bg-[#161616] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
                Upcoming
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[#111111] dark:text-white">{promotion.title}</h4>
            {promotion.description ? (
              <p className="mt-1 line-clamp-1 text-sm text-[#6b7280] dark:text-slate-400">
                {promotion.description}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-[#9ca3af] dark:text-slate-500">
              Starts {formatPromotionDate(promotion.start_date)}
            </p>
          </article>
        ))}

        {active.length === 0 && scheduled.length === 0 ? (
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
            <p className="text-sm text-[#6b7280] dark:text-slate-400">
              No active or upcoming promotions. Add one to guide promotional post ideas.
            </p>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setFormOpen(true)}
        className="mt-4 border-[#E5E7EB] dark:border-[#2a2a2a] bg-transparent text-violet-400 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add promotion
      </Button>

      <PromotionForm
        open={formOpen}
        companyId={companyId}
        activePlatforms={activePlatforms}
        onClose={() => setFormOpen(false)}
        onCreated={handlePromotionCreated}
      />
    </section>
  );
}
