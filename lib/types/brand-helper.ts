export type BrandHelperOutput = {
  unique_selling_point: string;
  target_audience: string;
  brand_voice_doc: string;
  tone: "professional" | "casual" | "playful" | "bold";
  suggested_topics_to_cover: string[];
};

export type BrandHelperApplyUpdates = {
  uniqueSellingPoint?: string;
  targetAudience?: string;
  brandVoiceDoc?: string;
  tone?: "Professional" | "Casual" | "Playful" | "Bold";
  topicsToCover?: string[];
};

export function mapBrandHelperTone(
  tone: BrandHelperOutput["tone"]
): NonNullable<BrandHelperApplyUpdates["tone"]> {
  const toneMap: Record<
    BrandHelperOutput["tone"],
    NonNullable<BrandHelperApplyUpdates["tone"]>
  > = {
    professional: "Professional",
    casual: "Casual",
    playful: "Playful",
    bold: "Bold",
  };

  return toneMap[tone];
}
