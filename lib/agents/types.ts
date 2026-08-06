import type { BrandConfig } from "@/lib/supabase/types";

export type TrendBriefAngle = {
  angle: string;
  why_now: string;
  suggested_content_type: "image" | "video" | "carousel";
  source_urls: string[];
  confidence: "low" | "medium" | "high";
  risk_notes: string | null;
};

export type TrendBrief = {
  fallback_used: boolean;
  generated_at: string;
  industry: string;
  angles: TrendBriefAngle[];
  raw_text: string;
};

export type MediaProvider = "flux" | "veo";

export type AgentCostContext = {
  companyId: string;
  runId?: string;
  postId?: string;
};

export type ProduceVisualParams = {
  postId: string;
  companyId: string;
  concept: string;
  contentType: "image" | "video" | "carousel";
  brandConfig: BrandConfig;
  context?: AgentCostContext;
};
