"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { MergedCompanyHoliday } from "@/lib/data/company-holidays";
import { resolveHolidayDate } from "@/lib/utils/holiday-dates";

type HolidayCalendarProps = {
  companySlug: string;
  initialHolidays?: MergedCompanyHoliday[];
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "universal", label: "Universal" },
  { id: "jamaica", label: "Jamaica" },
  { id: "cultural", label: "Cultural" },
  { id: "commercial", label: "Commercial" },
  { id: "us", label: "US" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDotColor(holiday: MergedCompanyHoliday): string {
  if (holiday.country_codes.length === 0) {
    return "#a78bfa";
  }
  if (holiday.country_codes.includes("JM")) {
    return "#6ee7b7";
  }
  if (holiday.country_codes.includes("US")) {
    return "#fb923c";
  }
  if (holiday.category === "cultural") {
    return "#67e8f9";
  }
  return "#f472b6";
}

export function HolidayCalendar({
  companySlug,
  initialHolidays,
}: HolidayCalendarProps) {
  const [holidays, setHolidays] = useState<MergedCompanyHoliday[]>(
    initialHolidays ?? []
  );
  const [loading, setLoading] = useState(!initialHolidays);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");

  const apiBase = `/api/dashboard/${companySlug}/holidays`;

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiBase);
      const payload = (await response.json()) as {
        data: MergedCompanyHoliday[] | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to load holidays.");
      }

      setHolidays(payload.data ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load holidays.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!initialHolidays) {
      void loadHolidays();
    }
  }, [initialHolidays, loadHolidays]);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  async function handleToggle(holiday: MergedCompanyHoliday) {
    const newEnabled = !holiday.enabled;
    setHolidays((prev) =>
      prev.map((item) =>
        item.id === holiday.id ? { ...item, enabled: newEnabled } : item
      )
    );
    setSaving(holiday.id);

    try {
      const response = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holiday_id: holiday.id,
          enabled: newEnabled,
        }),
      });

      const payload = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to update holiday.");
      }
    } catch (error) {
      setHolidays((prev) =>
        prev.map((item) =>
          item.id === holiday.id ? { ...item, enabled: holiday.enabled } : item
        )
      );
      const message =
        error instanceof Error ? error.message : "Failed to update holiday.";
      toast.error(message);
    } finally {
      setSaving(null);
    }
  }

  const upcomingHolidays = useMemo(() => {
    return holidays
      .map((holiday) => {
        const resolved_date =
          resolveHolidayDate(holiday, currentYear) ??
          resolveHolidayDate(holiday, currentYear + 1);

        if (!resolved_date) {
          return null;
        }

        const diff = resolved_date.getTime() - now.getTime();
        if (diff < 0 || diff > 21 * 24 * 60 * 60 * 1000) {
          return null;
        }

        return { ...holiday, resolved_date };
      })
      .filter(
        (
          holiday
        ): holiday is MergedCompanyHoliday & { resolved_date: Date } =>
          holiday !== null
      )
      .sort(
        (a, b) => a.resolved_date.getTime() - b.resolved_date.getTime()
      );
  }, [holidays, currentYear, now]);

  const enabledCount = holidays.filter((holiday) => holiday.enabled).length;

  const filtered = useMemo(() => {
    return holidays.filter(
      (holiday) =>
        activeCategory === "all" ||
        (activeCategory === "jamaica" &&
          holiday.country_codes.includes("JM")) ||
        (activeCategory === "us" && holiday.country_codes.includes("US")) ||
        (activeCategory === "universal" &&
          holiday.country_codes.length === 0) ||
        holiday.category === activeCategory
    );
  }, [holidays, activeCategory]);

  const grouped = useMemo(() => {
    return MONTH_NAMES.reduce<Record<number, MergedCompanyHoliday[]>>(
      (acc, _, index) => {
        const monthHolidays = filtered.filter(
          (holiday) => holiday.month === index + 1
        );
        if (monthHolidays.length > 0) {
          acc[index + 1] = monthHolidays;
        }
        return acc;
      },
      {}
    );
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[#6b7280] dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading holidays...
      </div>
    );
  }

  if (holidays.length === 0) {
    return (
      <p className="text-sm text-[#6b7280] dark:text-slate-400">
        No holidays configured yet. Ask your admin to seed the holiday calendar.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="mb-4 text-xs text-[#9ca3af] dark:text-slate-500">
        {enabledCount} of {holidays.length} enabled
      </p>

      {upcomingHolidays.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800/40 dark:bg-violet-900/20">
          <span className="flex flex-shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-400">
            <Sparkles size={12} />
            Coming up
          </span>
          {upcomingHolidays.map((holiday) => (
            <span
              key={holiday.id}
              className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-700 dark:border-violet-800/50 dark:bg-[#161616] dark:text-violet-300"
            >
              {holiday.custom_name ?? holiday.name}
              <span className="ml-1.5 text-violet-600 dark:text-violet-600">
                {holiday.resolved_date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              activeCategory === category.id
                ? "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-[#1f1f1f] dark:text-violet-300"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-[#2a2a2a] dark:bg-transparent dark:text-slate-500 dark:hover:border-[#2e2e5a] dark:hover:text-slate-300"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="py-8 text-center text-sm text-[#9ca3af] dark:text-slate-500">
          No holidays match this category.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(grouped).map(([monthNum, monthHolidays]) => (
            <div
              key={monthNum}
              className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616]"
            >
              <div className="bg-[#f8fafc] dark:bg-[#0a0a0a] px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                  {MONTH_NAMES[Number(monthNum) - 1]}
                </span>
              </div>

              <div className="flex flex-col p-2">
                {monthHolidays.map((holiday) => {
                  const date = resolveHolidayDate(holiday, currentYear);
                  const dotColor = getDotColor(holiday);

                  return (
                    <div
                      key={holiday.id}
                      className={`flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-1.5 last:border-0 ${
                        !holiday.enabled ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: dotColor }}
                        />
                        <div className="min-w-0">
                          <p
                            className={`truncate text-xs font-medium ${
                              holiday.enabled
                                ? "text-[#374151] dark:text-slate-200"
                                : "text-[#9ca3af] dark:text-slate-500 line-through"
                            }`}
                          >
                            {holiday.custom_name ?? holiday.name}
                          </p>
                          <p className="text-xs text-slate-600">
                            {date
                              ? date.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : `${WEEK_ORDINALS[(holiday.week_of_month ?? 1) - 1]} ${WEEKDAYS[holiday.day_of_week ?? 0]}`}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleToggle(holiday)}
                        disabled={saving === holiday.id}
                        aria-label={holiday.enabled ? "Disable" : "Enable"}
                        className={`relative ml-2 flex-shrink-0 rounded-full transition-colors duration-200 ${
                          saving === holiday.id
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                        style={{
                          width: "44px",
                          height: "24px",
                          background: holiday.enabled
                            ? "#CC2B2B"
                            : "var(--toggle-off, #d1d5db)",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: holiday.enabled ? "23px" : "3px",
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "white",
                            transition: "left 0.15s ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {[
          { color: "#a78bfa", label: "Universal" },
          { color: "#6ee7b7", label: "Jamaica" },
          { color: "#67e8f9", label: "Cultural" },
          { color: "#f472b6", label: "Commercial" },
          { color: "#fb923c", label: "US" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-xs text-[#9ca3af] dark:text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
