import type { LucideIcon } from "lucide-react";

import {
  STAT_COLORS,
  type StatColorVariant,
} from "@/lib/constants/theme-colors";
import { cn } from "@/lib/utils";

type DashboardStatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatColorVariant;
  accentClassName?: string;
  className?: string;
};

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  variant = "posts",
  accentClassName,
  className,
}: DashboardStatCardProps) {
  const colors = STAT_COLORS[variant];

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-sm",
        colors.bg,
        colors.border,
        accentClassName,
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cn("text-3xl font-semibold", colors.number)}>{value}</p>
          <p className={cn("mt-1 text-sm", colors.label)}>{label}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            colors.bg,
            colors.border
          )}
        >
          <Icon className={cn("h-5 w-5", colors.number)} aria-hidden />
        </div>
      </div>
    </div>
  );
}
