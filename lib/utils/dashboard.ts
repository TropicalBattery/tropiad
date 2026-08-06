import { endOfWeek, format, startOfWeek } from "date-fns";

export const PLATFORM_STYLES: Record<string, string> = {
  Instagram: "status-pill status-pill-platform",
  LinkedIn: "status-pill status-pill-platform",
  X: "status-pill status-pill-platform",
  Facebook: "status-pill status-pill-platform",
};

export function getPlatformStyle(platform: string): string {
  return PLATFORM_STYLES[platform] ?? "status-pill status-pill-platform";
}

export function getCurrentWeekStart(date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekRangeLabel(date = new Date()): string {
  const start = getCurrentWeekStart(date);
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function getWeekStartIso(date = new Date()): string {
  return format(getCurrentWeekStart(date), "yyyy-MM-dd");
}

export function formatScheduledAt(
  scheduledAt: string | null,
  timezone: string
): string {
  if (!scheduledAt) {
    return "Not scheduled";
  }

  return formatScheduleDisplay(scheduledAt, timezone);
}

export function formatScheduleDisplay(
  scheduledAt: string,
  timezone: string
): string {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const instant = new Date(scheduledAt);

  return `${dateFormatter.format(instant)} - ${timeFormatter.format(instant)}`;
}

export function toIsoFromLocalDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function pipelineStageLabel(status: string | undefined): string {
  switch (status) {
    case "ideation":
      return "Generating concepts";
    case "gate1":
      return "Awaiting concept approval";
    case "copywriting":
      return "Writing copy & visuals";
    case "gate2":
      return "Awaiting post approval";
    case "scheduling":
      return "Scheduling posts";
    case "published":
      return "Published this week";
    case "completed":
      return "Cycle complete";
    default:
      return status ? status.replace(/_/g, " ") : "Idle";
  }
}
