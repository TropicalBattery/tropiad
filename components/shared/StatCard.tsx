import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  STAT_COLORS,
  type StatColorVariant,
} from "@/lib/constants/theme-colors";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatColorVariant;
  iconClassName?: string;
  iconBgClassName?: string;
  href?: string;
  className?: string;
  footer?: ReactNode;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "posts",
  iconClassName,
  iconBgClassName,
  href,
  className,
  footer,
}: StatCardProps) {
  const colors = STAT_COLORS[variant];

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("font-display text-3xl font-semibold", colors.number)}>
            {value}
          </p>
          <p className={cn("mt-1 text-sm", colors.label)}>{label}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
            iconBgClassName ?? colors.bg,
            colors.border
          )}
        >
          <Icon
            className={cn("h-5 w-5", iconClassName ?? colors.number)}
          />
        </div>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </>
  );

  const cardClassName = cn(
    "block rounded-xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
    colors.bg,
    colors.border,
    href && "cursor-pointer hover:opacity-95",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
