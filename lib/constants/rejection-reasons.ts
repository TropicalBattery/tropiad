export const REJECTION_REASONS = {
  OFF_BRAND_TONE: "Off-brand tone",
  FACTUALLY_INCORRECT: "Factually incorrect or shouldn't say this",
  WRONG_TOPIC: "Wrong topic or focus",
  VISUAL_MISMATCH: "Image/video doesn't match our business",
  TOO_PROMOTIONAL: "Too promotional",
  OTHER: "Other",
} as const;

export type RejectionReason =
  (typeof REJECTION_REASONS)[keyof typeof REJECTION_REASONS];

export const GATE1_REJECTION_REASONS: RejectionReason[] = [
  REJECTION_REASONS.OFF_BRAND_TONE,
  REJECTION_REASONS.FACTUALLY_INCORRECT,
  REJECTION_REASONS.WRONG_TOPIC,
  REJECTION_REASONS.TOO_PROMOTIONAL,
  REJECTION_REASONS.OTHER,
];

export function getGate2RejectionReasons(
  hasVisual: boolean
): RejectionReason[] {
  const reasons: RejectionReason[] = [
    REJECTION_REASONS.OFF_BRAND_TONE,
    REJECTION_REASONS.FACTUALLY_INCORRECT,
    REJECTION_REASONS.WRONG_TOPIC,
    REJECTION_REASONS.TOO_PROMOTIONAL,
    REJECTION_REASONS.OTHER,
  ];

  if (hasVisual) {
    reasons.splice(3, 0, REJECTION_REASONS.VISUAL_MISMATCH);
  }

  return reasons;
}

export type RejectionGate = "gate1" | "gate2";

export function getRecurringFeedbackSuggestion(reason: string): string | null {
  switch (reason) {
    case REJECTION_REASONS.OFF_BRAND_TONE:
      return " - consider reviewing the Brand Voice document";
    case REJECTION_REASONS.WRONG_TOPIC:
      return " - consider adding more topics_to_cover";
    case REJECTION_REASONS.VISUAL_MISMATCH:
      return " - consider adding visual_references or reviewing image_style";
    default:
      return null;
  }
}
