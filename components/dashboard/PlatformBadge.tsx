import { cn } from "@/lib/utils";

type PlatformBadgeProps = {
  platform: string;
  className?: string;
};

function normalizePlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === "x") {
    return "twitter";
  }
  return normalized;
}

export function getPlatformBadgeClass(platform: string): string {
  const key = normalizePlatform(platform);

  if (key === "instagram") {
    return "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800";
  }

  if (key === "facebook") {
    return "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  }

  if (key === "twitter") {
    return "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800";
  }

  if (key === "linkedin") {
    return "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
  }

  if (key === "tiktok") {
    return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  }

  return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex text-xs px-2.5 py-1 rounded-full border font-medium capitalize",
        getPlatformBadgeClass(platform),
        className
      )}
    >
      {platform}
    </span>
  );
}

type ContentTypeBadgeProps = {
  contentType: string;
  className?: string;
};

export function getContentTypePillClass(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();

  if (normalized === "image") {
    return "status-pill status-pill-image";
  }

  if (normalized === "video") {
    return "status-pill status-pill-video";
  }

  if (normalized === "carousel") {
    return "status-pill status-pill-carousel";
  }

  return "status-pill status-pill-neutral";
}

export function ContentTypeBadge({
  contentType,
  className,
}: ContentTypeBadgeProps) {
  return (
    <span className={cn(getContentTypePillClass(contentType), className)}>
      {contentType}
    </span>
  );
}
