export const STAT_COLORS = {
  posts: {
    bg: "bg-white dark:bg-[#161616]",
    border: "border-[#E5E7EB] dark:border-[#2a2a2a]",
    number: "text-[#111111] dark:text-white",
    label: "text-[#6B7280] dark:text-[#a3a3a3]",
  },
  pending: {
    bg: "bg-white dark:bg-[#161616]",
    border: "border-[#E5E7EB] dark:border-[#2a2a2a]",
    number: "text-tbc-amber dark:text-tbc-amber",
    label: "text-[#6B7280] dark:text-[#a3a3a3]",
  },
  published: {
    bg: "bg-white dark:bg-[#161616]",
    border: "border-[#E5E7EB] dark:border-[#2a2a2a]",
    number: "text-[#15803d] dark:text-emerald-300",
    label: "text-[#6B7280] dark:text-[#a3a3a3]",
  },
  cost: {
    bg: "bg-white dark:bg-[#161616]",
    border: "border-[#E5E7EB] dark:border-[#2a2a2a]",
    number: "text-tbc-red dark:text-[#f87171]",
    label: "text-[#6B7280] dark:text-[#a3a3a3]",
  },
} as const;

export type StatColorVariant = keyof typeof STAT_COLORS;

export const CONTENT_TYPE_COLORS = {
  Image:
    "bg-[#eff6ff] dark:bg-blue-900/40 text-[#1d4ed8] dark:text-blue-300 border-[#bfdbfe] dark:border-blue-800",
  Video:
    "bg-[#fdf2f2] dark:bg-[#4a0d0d]/40 text-[#CC2B2B] dark:text-purple-300 border-[#f8caca] dark:border-purple-800",
  Carousel:
    "bg-[#f0fdf4] dark:bg-emerald-900/40 text-[#15803d] dark:text-emerald-300 border-[#bbf7d0] dark:border-emerald-800",
} as const;

export const STAGE_COLORS = {
  gate1_pending:
    "bg-[#fef3c7] dark:bg-amber-900/40 text-[#b45309] dark:text-amber-400 border-[#fde68a] dark:border-amber-800",
  gate2_pending:
    "bg-[#fdf2f2] dark:bg-[#4a0d0d]/40 text-[#CC2B2B] dark:text-purple-300 border-[#f8caca] dark:border-purple-800",
  complete:
    "bg-[#f0fdf4] dark:bg-emerald-900/40 text-[#15803d] dark:text-emerald-300 border-[#bbf7d0] dark:border-emerald-800",
  failed:
    "bg-[#fef2f2] dark:bg-rose-900/40 text-[#dc2626] dark:text-rose-300 border-[#fecaca] dark:border-rose-800",
  producing:
    "bg-[#eff6ff] dark:bg-blue-900/40 text-[#1d4ed8] dark:text-blue-300 border-[#bfdbfe] dark:border-blue-800",
} as const;

export function getContentTypeBadgeClass(contentType: string): string {
  const key = contentType as keyof typeof CONTENT_TYPE_COLORS;
  return (
    CONTENT_TYPE_COLORS[key] ??
    "bg-[#f8fafc] dark:bg-slate-800/40 text-[#6b7280] dark:text-slate-300 border-[#dde4ee] dark:border-slate-700"
  );
}

export function getStageBadgeClass(stage: string): string {
  const key = stage as keyof typeof STAGE_COLORS;
  return (
    STAGE_COLORS[key] ??
    "bg-[#f8fafc] dark:bg-slate-800/40 text-[#6b7280] dark:text-slate-400 border-[#dde4ee] dark:border-slate-700"
  );
}

export function getRunStatusBadgeClass(status: string): string {
  switch (status) {
    case "complete":
      return STAGE_COLORS.complete;
    case "failed":
      return STAGE_COLORS.failed;
    case "gate1_pending":
      return STAGE_COLORS.gate1_pending;
    case "gate2_pending":
      return STAGE_COLORS.gate2_pending;
    case "publishing":
    case "running":
    case "pending":
    case "producing":
      return STAGE_COLORS.producing;
    default:
      return "bg-[#f8fafc] dark:bg-slate-800/40 text-[#6b7280] dark:text-slate-400 border-[#dde4ee] dark:border-slate-700";
  }
}

export function getPipelineStageBadgeClass(stage: string): string {
  switch (stage) {
    case "published":
      return STAGE_COLORS.complete;
    case "failed":
      return STAGE_COLORS.failed;
    case "ready":
      return STAGE_COLORS.gate2_pending;
    case "producing":
    case "visual":
    case "copywriting":
      return STAGE_COLORS.producing;
    default:
      return "bg-[#f8fafc] dark:bg-slate-800/40 text-[#6b7280] dark:text-slate-400 border-[#dde4ee] dark:border-slate-700";
  }
}
