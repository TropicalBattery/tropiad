import { cn } from "@/lib/utils";

type StatusTone = "success" | "danger" | "neutral" | "platform";

type StatusBadgeProps = {
  status: string;
  tone?: StatusTone;
  className?: string;
};

function resolveTone(status: string): StatusTone {
  const value = status.toLowerCase().replace(/_/g, " ");

  if (
    ["ready", "approved", "published", "succeeded", "complete", "completed"].includes(
      value
    )
  ) {
    return "success";
  }

  if (["failed", "rejected"].includes(value)) {
    return "danger";
  }

  return "neutral";
}

const toneClassName: Record<StatusTone, string> = {
  success: "status-pill status-pill-success",
  danger: "status-pill status-pill-danger",
  neutral: "status-pill status-pill-neutral",
  platform: "status-pill status-pill-platform",
};

export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? resolveTone(status);

  return (
    <span className={cn(toneClassName[resolvedTone], className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
