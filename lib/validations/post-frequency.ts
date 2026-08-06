export const FREQUENCY_OPTIONS = [
  { value: 1, label: "Once a week" },
  { value: 2, label: "Twice a week" },
  { value: 3, label: "3x per week" },
  { value: 5, label: "5x per week" },
  { value: 7, label: "Daily" },
] as const;

/** @deprecated Use FREQUENCY_OPTIONS */
export const POST_FREQUENCY_OPTIONS = FREQUENCY_OPTIONS;

export const DEFAULT_POST_FREQUENCY = 3;

export const DEFAULT_POST_FREQUENCY_LABEL = "3x per week";

export function getPostFrequencyLabel(
  postFrequency: number | null | undefined
): string {
  return (
    FREQUENCY_OPTIONS.find((option) => option.value === postFrequency)?.label ??
    DEFAULT_POST_FREQUENCY_LABEL
  );
}
