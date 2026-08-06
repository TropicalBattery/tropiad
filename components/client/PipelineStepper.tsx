import {
  Check,
  CheckSquare,
  Lightbulb,
  RefreshCw,
  Send,
  Wand2,
} from "lucide-react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "research", label: "Trend Research", icon: RefreshCw },
  { key: "ideation", label: "Concept Generation", icon: Lightbulb },
  { key: "gate1", label: "Gate 1 Approval", icon: CheckSquare },
  { key: "production", label: "Content Production", icon: Wand2 },
  { key: "gate2", label: "Gate 2 Approval", icon: CheckSquare },
  { key: "publishing", label: "Publishing", icon: Send },
] as const;

type PipelineStepperProps = {
  status?: string;
};

function getActiveIndex(status?: string): number {
  switch (status) {
    case "research":
    case "ideation":
      return 1;
    case "gate1":
      return 2;
    case "copywriting":
    case "visual":
      return 3;
    case "gate2":
      return 4;
    case "scheduling":
    case "published":
      return 5;
    default:
      return 0;
  }
}

export function PipelineStepper({ status }: PipelineStepperProps) {
  const activeIndex = getActiveIndex(status);

  return (
    <div className="space-y-4">
      {status ? (
        <StatusBadge status={status} className="mb-2" />
      ) : (
        <StatusBadge status="idle" tone="neutral" className="mb-2" />
      )}

      {STEPS.map((step, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                completed &&
                  "border-accent-teal bg-accent-teal text-bg-base shadow-[0_0_16px_rgba(0,230,195,0.35)]",
                active &&
                  "border-accent-violet bg-[rgba(124,92,255,0.12)] shadow-[0_0_16px_rgba(124,92,255,0.25)]",
                !completed &&
                  !active &&
                  "border-border-subtle bg-bg-surface-hover text-text-muted"
              )}
            >
              {completed ? (
                <Check className="h-4 w-4" />
              ) : active ? (
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent-violet" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-text-muted/40" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active || completed ? "text-accent-violet" : "text-text-muted"
                  )}
                />
                <p
                  className={cn(
                    "text-sm font-medium",
                    active ? "font-display text-text-primary" : "text-text-muted"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
