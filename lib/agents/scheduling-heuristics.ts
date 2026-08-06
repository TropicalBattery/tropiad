import { addDays, format, parseISO } from "date-fns";

export type SuggestedTimeTag = "morning" | "midday" | "evening" | "anytime";

export type SuggestedSlot = {
  dayOfWeek: number;
  hour: number;
  minute: number;
};

type SlotTime = {
  hour: number;
  minute: number;
};

const TAG_ORDER: SuggestedTimeTag[] = [
  "morning",
  "midday",
  "evening",
  "anytime",
];

const FOOD_HOSPITALITY_INDUSTRIES = [
  "food",
  "beverage",
  "hospitality",
  "restaurant",
  "cafe",
  "coffee",
];

const INDUSTRY_SLOT_DEFAULTS: Record<SuggestedTimeTag, SlotTime> = {
  morning: { hour: 7, minute: 30 },
  midday: { hour: 12, minute: 0 },
  evening: { hour: 18, minute: 30 },
  anytime: { hour: 12, minute: 0 },
};

const GENERIC_SLOT_DEFAULTS: Record<SuggestedTimeTag, SlotTime> = {
  morning: { hour: 7, minute: 30 },
  midday: { hour: 12, minute: 0 },
  evening: { hour: 18, minute: 30 },
  anytime: { hour: 12, minute: 0 },
};

function normalizeTimeTag(timeTag: string): SuggestedTimeTag {
  const normalized = timeTag.trim().toLowerCase();

  if (
    normalized === "morning" ||
    normalized === "midday" ||
    normalized === "evening" ||
    normalized === "anytime"
  ) {
    return normalized;
  }

  return "anytime";
}

function matchesFoodHospitality(industry: string[]): boolean {
  return industry.some((value) => {
    const normalized = value.trim().toLowerCase();
    return FOOD_HOSPITALITY_INDUSTRIES.some((keyword) =>
      normalized.includes(keyword)
    );
  });
}

function getStaticSlot(industry: string[], timeTag: SuggestedTimeTag): SlotTime {
  const defaults = matchesFoodHospitality(industry)
    ? INDUSTRY_SLOT_DEFAULTS
    : GENERIC_SLOT_DEFAULTS;

  return defaults[timeTag];
}

function parsePreferredTime(value: string): SlotTime | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

/**
 * Builds evenly spaced weekday numbers (Mon=1 .. Sun=7) for a weekly cadence.
 * Examples: frequency 5 -> [1,2,3,4,5]; frequency 3 -> [1,3,5].
 * Callers assign a post to validDays[postIndex % validDays.length].
 */
function getValidWeekdays(postFrequency: number): number[] {
  const capped = Math.max(1, Math.min(postFrequency, 7));
  const weekdays =
    capped <= 5
      ? [1, 2, 3, 4, 5]
      : capped === 6
        ? [1, 2, 3, 4, 5, 6]
        : [1, 2, 3, 4, 5, 6, 7];

  if (capped === weekdays.length) {
    return weekdays;
  }

  if (capped === 1) {
    return [weekdays[0]];
  }

  const selected: number[] = [];

  for (let index = 0; index < capped; index += 1) {
    const weekdayIndex = Math.round(
      (index * (weekdays.length - 1)) / (capped - 1)
    );
    selected.push(weekdays[weekdayIndex]);
  }

  return Array.from(new Set(selected));
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  return format(addDays(parseISO(isoDate), days), "yyyy-MM-dd");
}

function readZonedDateTimeParts(
  instant: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

export function zonedLocalDateTimeToUtcIso(
  dateIso: string,
  hour: number,
  minute: number,
  timeZone: string
): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = readZonedDateTimeParts(new Date(utcMs), timeZone);

    if (
      zoned.year === year &&
      zoned.month === month &&
      zoned.day === day &&
      zoned.hour === hour &&
      zoned.minute === minute
    ) {
      return new Date(utcMs).toISOString();
    }

    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      0
    );
    utcMs += desiredMs - actualMs;
  }

  return new Date(utcMs).toISOString();
}

/**
 * Converts a weekday slot anchored to week_start into a UTC timestamptz.
 * Rolls forward by 7 days when the slot is not after `now`.
 */
export function computeSuggestedScheduledAt(
  weekStart: string,
  timezone: string,
  slot: SuggestedSlot,
  now: Date = new Date()
): string {
  const dayOffset = slot.dayOfWeek - 1;
  let targetDate = addDaysToIsoDate(weekStart, dayOffset);
  let utcIso = zonedLocalDateTimeToUtcIso(
    targetDate,
    slot.hour,
    slot.minute,
    timezone
  );
  let candidate = new Date(utcIso);

  while (candidate.getTime() <= now.getTime()) {
    targetDate = addDaysToIsoDate(targetDate, 7);
    utcIso = zonedLocalDateTimeToUtcIso(
      targetDate,
      slot.hour,
      slot.minute,
      timezone
    );
    candidate = new Date(utcIso);
  }

  return utcIso;
}

export function buildSuggestedScheduledAt(params: {
  weekStart: string;
  timezone: string;
  industry: string[];
  timeTag: string;
  preferredTimes: Record<string, string> | null | undefined;
  postFrequency: number;
  platform: string;
  now?: Date;
}): string {
  const slot = getSuggestedSlot(
    params.industry,
    params.timeTag,
    params.preferredTimes,
    params.postFrequency,
    params.platform
  );

  return computeSuggestedScheduledAt(
    params.weekStart,
    params.timezone,
    slot,
    params.now
  );
}

export function getSuggestedSlot(
  industry: string[],
  timeTag: string,
  preferredTimes: Record<string, string> | null | undefined,
  postFrequency: number,
  platform: string
): SuggestedSlot {
  const normalizedTag = normalizeTimeTag(timeTag);
  const staticSlot = getStaticSlot(industry, normalizedTag);

  const preferredTime = preferredTimes?.[platform];
  const parsedPreferred =
    preferredTime !== undefined ? parsePreferredTime(preferredTime) : null;

  const slot = parsedPreferred ?? staticSlot;

  const validWeekdays = getValidWeekdays(postFrequency);
  const tagIndex = Math.max(TAG_ORDER.indexOf(normalizedTag), 0);
  const dayOfWeek = validWeekdays[tagIndex % validWeekdays.length];

  return {
    dayOfWeek,
    hour: slot.hour,
    minute: slot.minute,
  };
}
