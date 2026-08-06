export type HolidayDateInput = {
  id: string;
  name: string;
  description: string | null;
  month: number;
  day: number | null;
  week_of_month: number | null;
  day_of_week: number | null;
  country_codes: string[];
  category: string;
};

export function resolveHolidayDate(
  holiday: HolidayDateInput,
  year: number
): Date | null {
  if (holiday.day) {
    return new Date(year, holiday.month - 1, holiday.day);
  }

  if (holiday.week_of_month !== null && holiday.day_of_week !== null) {
    const firstDay = new Date(year, holiday.month - 1, 1);
    const firstDayOfWeek = firstDay.getDay();
    let offset = holiday.day_of_week - firstDayOfWeek;
    if (offset < 0) {
      offset += 7;
    }
    const firstOccurrence = 1 + offset;
    const nthOccurrence = firstOccurrence + (holiday.week_of_month - 1) * 7;
    return new Date(year, holiday.month - 1, nthOccurrence);
  }

  return null;
}

export function getUpcomingHolidays(
  holidays: HolidayDateInput[],
  daysAhead: number = 21
): Array<HolidayDateInput & { resolved_date: Date }> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const year = now.getFullYear();

  const results: Array<HolidayDateInput & { resolved_date: Date }> = [];

  for (const holiday of holidays) {
    let date = resolveHolidayDate(holiday, year);
    if (date && date >= now && date <= future) {
      results.push({ ...holiday, resolved_date: date });
      continue;
    }

    date = resolveHolidayDate(holiday, year + 1);
    if (date && date >= now && date <= future) {
      results.push({ ...holiday, resolved_date: date });
    }
  }

  return results.sort(
    (a, b) => a.resolved_date.getTime() - b.resolved_date.getTime()
  );
}

export function getRelevantHolidays(
  holidays: HolidayDateInput[],
  demographic: string,
  daysAhead: number = 21
): Array<HolidayDateInput & { resolved_date: Date }> {
  const upcoming = getUpcomingHolidays(holidays, daysAhead);

  return upcoming.filter((holiday) => {
    if (holiday.country_codes.length === 0) {
      return true;
    }

    if (demographic === "local" || demographic === "mixed") {
      if (holiday.country_codes.includes("JM")) {
        return true;
      }
    }

    if (demographic === "tourist" || demographic === "mixed") {
      if (holiday.country_codes.includes("US")) {
        return true;
      }
    }

    return false;
  });
}
