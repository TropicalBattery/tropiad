import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type CalendarMonth = {
  year: number;
  month: number;
};

export type CalendarCell = {
  year: number;
  month: number;
  day: number;
  inCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getWeekdayLabels(): string[] {
  return WEEKDAY_LABELS;
}

export function parseCalendarMonthParam(
  value: string | undefined,
  reference = new Date()
): CalendarMonth {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [yearText, monthText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);

    if (year >= 1970 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  return {
    year: reference.getFullYear(),
    month: reference.getMonth() + 1,
  };
}

export function formatCalendarMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatCalendarMonthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

export function shiftCalendarMonth(
  year: number,
  month: number,
  delta: number
): CalendarMonth {
  const shifted = addMonths(new Date(year, month - 1, 1), delta);
  return {
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
  };
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    inCurrentMonth: isSameMonth(date, monthStart),
  }));
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getScheduledLocalDateKey(
  scheduledAt: string,
  timezone: string
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(scheduledAt));
}

export function formatScheduleTime(
  scheduledAt: string,
  timezone: string
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(scheduledAt));
}

export function truncateCaption(value: string | null, maxLength = 30): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "No caption";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
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

function zonedLocalDateTimeToUtcIso(
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

export function getMonthScheduledRange(
  timezone: string,
  year: number,
  month: number
): { start: string; end: string } {
  const monthStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = shiftCalendarMonth(year, month, 1);
  const nextMonthStartDate = `${nextMonth.year}-${String(nextMonth.month).padStart(2, "0")}-01`;

  return {
    start: zonedLocalDateTimeToUtcIso(monthStartDate, 0, 0, timezone),
    end: zonedLocalDateTimeToUtcIso(nextMonthStartDate, 0, 0, timezone),
  };
}
