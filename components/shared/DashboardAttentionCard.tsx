import Link from "next/link";
import type { ReactNode } from "react";

import {
  ContentTypeBadge,
  PlatformBadge,
} from "@/components/dashboard/PlatformBadge";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardAttentionCardProps = {
  platform: string;
  contentType: string;
  text: string;
  reviewHref: string;
  gateLabel: string;
  gateLabelClassName?: string;
  media?: ReactNode;
  className?: string;
};

export function DashboardAttentionCard({
  platform,
  contentType,
  text,
  reviewHref,
  gateLabel,
  gateLabelClassName = "status-pill status-pill-neutral",
  media,
  className,
}: DashboardAttentionCardProps) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col overflow-hidden",
        className
      )}
    >
      {media}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={platform} />
          <span className={gateLabelClassName}>{gateLabel}</span>
          <ContentTypeBadge contentType={contentType} />
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <ExpandableText text={text} />
        </div>

        <div className="mt-auto flex shrink-0 justify-end pt-3">
          <Button asChild size="sm">
            <Link href={reviewHref}>Review</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
