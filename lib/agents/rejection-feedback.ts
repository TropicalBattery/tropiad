// Server-only: do not import this module into client components.

import { createAdminClient } from "@/lib/supabase/admin";
import type { RejectionFeedback } from "@/lib/supabase/types";

export type RecurringFeedbackAlert = {
  reason: string;
  count: number;
};

function formatFeedbackLine(row: RejectionFeedback): string {
  const concept = row.concept_snapshot?.trim() || "Unknown concept";
  const reasonsText = row.reasons.join(", ");
  const note = row.free_text?.trim()
    ? `. Additional note: ${row.free_text.trim()}`
    : "";

  return `- Concept: "${concept}" - Rejected because: ${reasonsText}${note}`;
}

export async function getRecentRejectionSummary(
  companyId: string,
  limit: number = 10,
  sinceDays: number = 30
): Promise<string> {
  const admin = createAdminClient();
  const since = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .from("rejection_feedback")
    .select("*")
    .eq("company_id", companyId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(
      `[rejection-feedback] Failed to load summary: ${error.message}`
    );
    return "";
  }

  if (!data || data.length === 0) {
    return "";
  }

  const lines = data.map(formatFeedbackLine);

  return [
    "Recent client feedback on rejected content (avoid repeating these issues):",
    ...lines,
  ].join("\n");
}

export async function getRecurringFeedbackAlerts(
  companyId: string
): Promise<RecurringFeedbackAlert[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("rejection_feedback")
    .select("reasons")
    .eq("company_id", companyId)
    .gte("created_at", since);

  if (error) {
    console.warn(
      `[rejection-feedback] Failed to load recurring alerts: ${error.message}`
    );
    return [];
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    for (const reason of row.reasons ?? []) {
      const trimmed = reason.trim();
      if (!trimmed) {
        continue;
      }
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count);
}
