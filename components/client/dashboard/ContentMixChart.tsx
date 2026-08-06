"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { ContentMixPercentages } from "@/lib/utils/client-dashboard";

type ContentMixChartProps = {
  mix: ContentMixPercentages;
};

const LEGEND_ITEMS = [
  { key: "educational" as const, label: "Educational", color: "#CC2B2B" },
  { key: "promotional" as const, label: "Promotional", color: "#F5A000" },
  { key: "engagement" as const, label: "Engagement", color: "#111111" },
];

const EMPTY_COLOR = "#E5E7EB";

export function ContentMixChart({ mix }: ContentMixChartProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const slices = mix
    ? LEGEND_ITEMS.map((item) => ({
        name: item.label,
        value: mix[item.key],
        color: item.color,
      }))
    : LEGEND_ITEMS.map((item) => ({
        name: item.label,
        value: 1,
        color: EMPTY_COLOR,
      }));

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616]">
      <h3 className="mb-4 text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
        Content Mix
      </h3>

      <div className="h-44 min-h-[11rem] min-w-0 w-full">
        {ready ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      {!mix ? (
        <p className="mb-3 text-center text-xs text-[#9ca3af] dark:text-slate-500">No data yet</p>
      ) : null}

      <div className="mt-2 space-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: mix ? item.color : EMPTY_COLOR }}
                aria-hidden
              />
              <span className="text-[#6b7280] dark:text-slate-400">{item.label}</span>
            </div>
            <span className="font-medium text-[#111111] dark:text-white">
              {mix ? `${mix[item.key]}%` : "--"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
