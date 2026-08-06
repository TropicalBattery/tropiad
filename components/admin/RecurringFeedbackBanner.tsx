"use client";

import { AlertTriangle } from "lucide-react";

import type { RecurringFeedbackAlert } from "@/lib/agents/rejection-feedback";
import { getRecurringFeedbackSuggestion } from "@/lib/constants/rejection-reasons";

type RecurringFeedbackBannerProps = {
  alerts: RecurringFeedbackAlert[];
};

export function RecurringFeedbackBanner({ alerts }: RecurringFeedbackBannerProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const suggestion = getRecurringFeedbackSuggestion(alert.reason);

        return (
          <div
            key={alert.reason}
            className="rounded-xl border border-amber-200 bg-amber-50 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <p className="text-sm text-amber-950">
                Recurring feedback this month: &apos;{alert.reason}&apos; (
                {alert.count} times)
                {suggestion ?? ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
