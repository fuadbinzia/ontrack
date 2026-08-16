import { addDays, fromDateKey, toDateKey } from '@/utils/date';

export type HolidayRegion = 'US' | 'CA' | 'GB' | 'AU' | 'IE' | 'common';

export type CalendarHoliday = {
  id: string;
  date: string;
  name: string;
  region: HolidayRegion;
  slug: string;
};

const SUPPORTED_REGIONS = new Set<HolidayRegion>([
  'US',
  'CA',
  'GB',
  'AU',
  'IE',
  'common',
]);

const yearCache = new Map<string, CalendarHoliday[]>();

/** Public / widely observed holidays for the device locale (US when unknown). */
export function holidayRegionFromLocale(locale: string): HolidayRegion {
  const region = regionFromLocale(locale);
  if (region && SUPPORTED_REGIONS.has(region as HolidayRegion)) {
    return region as HolidayRegion;
  }
  if (!region && /^en\b/i.test(locale.replace('_', '-'))) return 'US';
  return region ? 'common' : 'US';
}

export function holidaysOnDate(
  date: string,
  region: HolidayRegion,
): CalendarHoliday[] {
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) return [];
  return holidaysForYear(year, region).filter((holiday) => holiday.date === date);
}

export function holidayDatesIn(
  dates: Iterable<string>,
  region: HolidayRegion,
): Set<string> {
  const wanted = dates instanceof Set ? dates : new Set(dates);
  const years = new Set(
    [...wanted].map((date) => Number(date.slice(0, 4))).filter(Number.isFinite),
  );
  const found = new Set<string>();
  for (const year of years) {
    for (const holiday of holidaysForYear(year, region)) {
      if (wanted.has(holiday.date)) found.add(holiday.date);
    }
  }
  return found;
}

export function holidaysForYear(
  year: number,
  region: HolidayRegion,
): CalendarHoliday[] {
  const key = `${region}:${year}`;
  const cached = yearCache.get(key);
  if (cached) return cached;
  const built = buildHolidaysForYear(year, region).sort((a, b) =>
    a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
  yearCache.set(key, built);
  return built;
}

function buildHolidaysForYear(
  year: number,
  region: HolidayRegion,
): CalendarHoliday[] {
  const list: CalendarHoliday[] = [];
  const add = (
    date: string,
    name: string,
    slug: string,
    options?: { observed?: boolean },
  ) => {
    if (!date.startsWith(`${year}-`)) return;
    list.push({
      id: `${region}-${slug}${options?.observed ? '-observed' : ''}`,
      date,
      name: options?.observed ? `${name} (Observed)` : name,
      region,
      slug,
    });
  };
  const addFixed = (
    month: number,
    day: number,
    name: string,
    slug: string,
    options?: { observe?: boolean },
  ) => {
    const date = toDateKey(new Date(year, month, day, 12));
    add(date, name, slug);
    if (options?.observe) {
      const observed = observedWeekday(date);
      if (observed) add(observed, name, slug, { observed: true });
    }
  };

  addFixed(0, 1, "New Year's Day", 'new-years-day', { observe: region !== 'common' });
  addFixed(11, 25, 'Christmas Day', 'christmas-day', { observe: region !== 'common' });
  addFixed(11, 31, "New Year's Eve", 'new-years-eve');

  if (region === 'US') {
    add(nthWeekday(year, 0, 1, 3), 'Martin Luther King Jr. Day', 'mlk-day');
    addFixed(1, 14, "Valentine's Day", 'valentines-day');
    add(nthWeekday(year, 1, 1, 3), "Presidents' Day", 'presidents-day');
    addFixed(2, 17, "St. Patrick's Day", 'st-patricks-day');
    add(toDateKey(easterSunday(year)), 'Easter Sunday', 'easter');
    add(nthWeekday(year, 4, 0, 2), "Mother's Day", 'mothers-day');
    add(lastWeekday(year, 4, 1), 'Memorial Day', 'memorial-day');
    addFixed(5, 19, 'Juneteenth', 'juneteenth', { observe: true });
    add(nthWeekday(year, 5, 0, 3), "Father's Day", 'fathers-day');
    addFixed(6, 4, 'Independence Day', 'independence-day', { observe: true });
    add(nthWeekday(year, 8, 1, 1), 'Labor Day', 'labor-day');
    add(nthWeekday(year, 9, 1, 2), 'Indigenous Peoples’ Day', 'indigenous-peoples-day');
    addFixed(9, 31, 'Halloween', 'halloween');
    addFixed(10, 11, 'Veterans Day', 'veterans-day', { observe: true });
    add(nthWeekday(year, 10, 4, 4), 'Thanksgiving', 'thanksgiving');
    addFixed(11, 24, 'Christmas Eve', 'christmas-eve');
  }

  if (region === 'CA') {
    add(addDays(toDateKey(easterSunday(year)), -2), 'Good Friday', 'good-friday');
    add(addDays(toDateKey(easterSunday(year)), 1), 'Easter Monday', 'easter-monday');
    add(weekdayOnOrBefore(year, 4, 24, 1), 'Victoria Day', 'victoria-day');
    addFixed(6, 1, 'Canada Day', 'canada-day', { observe: true });
    add(nthWeekday(year, 8, 1, 1), 'Labour Day', 'labour-day');
    add(nthWeekday(year, 9, 1, 2), 'Thanksgiving', 'thanksgiving');
    addFixed(10, 11, 'Remembrance Day', 'remembrance-day');
    addFixed(11, 26, 'Boxing Day', 'boxing-day', { observe: true });
  }

  if (region === 'GB' || region === 'IE') {
    add(addDays(toDateKey(easterSunday(year)), -2), 'Good Friday', 'good-friday');
    add(addDays(toDateKey(easterSunday(year)), 1), 'Easter Monday', 'easter-monday');
    add(nthWeekday(year, 4, 1, 1), 'Early May Bank Holiday', 'early-may-bank');
    add(lastWeekday(year, 4, 1), 'Spring Bank Holiday', 'spring-bank');
    add(lastWeekday(year, 7, 1), 'Summer Bank Holiday', 'summer-bank');
    addFixed(11, 26, 'Boxing Day', 'boxing-day', { observe: true });
    if (region === 'IE') {
      addFixed(2, 17, "St. Patrick's Day", 'st-patricks-day', { observe: true });
    }
  }

  if (region === 'AU') {
    addFixed(0, 26, 'Australia Day', 'australia-day', { observe: true });
    add(addDays(toDateKey(easterSunday(year)), -2), 'Good Friday', 'good-friday');
    add(addDays(toDateKey(easterSunday(year)), 1), 'Easter Monday', 'easter-monday');
    addFixed(3, 25, 'ANZAC Day', 'anzac-day');
    add(nthWeekday(year, 5, 1, 2), "King's Birthday", 'kings-birthday');
    addFixed(11, 26, 'Boxing Day', 'boxing-day', { observe: true });
  }

  // New Year's observed can land on Dec 31 of the previous year.
  if (region !== 'common') {
    const nextNewYear = toDateKey(new Date(year + 1, 0, 1, 12));
    const observed = observedWeekday(nextNewYear);
    if (observed) add(observed, "New Year's Day", 'new-years-day', { observed: true });
  }

  return list;
}

function regionFromLocale(locale: string): string | undefined {
  const normalized = locale.replace('_', '-');
  try {
    if (typeof Intl.Locale === 'function') {
      return new Intl.Locale(normalized).maximize().region?.toUpperCase();
    }
  } catch {
    // Fall through to the BCP-47 region segment.
  }
  return normalized
    .split('-')
    .find(
      (segment) =>
        /^[A-Za-z]{2}$/.test(segment)
        && segment.toLowerCase() !== normalized.slice(0, 2).toLowerCase(),
    )
    ?.toUpperCase();
}

/** Saturday → Friday, Sunday → Monday. */
function observedWeekday(date: string): string | undefined {
  const day = fromDateKey(date).getDay();
  if (day === 6) return addDays(date, -1);
  if (day === 0) return addDays(date, 1);
  return undefined;
}

function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): string {
  const first = new Date(year, month, 1, 12);
  const offset = (weekday - first.getDay() + 7) % 7;
  return toDateKey(new Date(year, month, 1 + offset + (n - 1) * 7, 12));
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(year, month + 1, 0, 12);
  const offset = (last.getDay() - weekday + 7) % 7;
  return toDateKey(new Date(year, month, last.getDate() - offset, 12));
}

function weekdayOnOrBefore(
  year: number,
  month: number,
  day: number,
  weekday: number,
): string {
  const date = new Date(year, month, day, 12);
  const offset = (date.getDay() - weekday + 7) % 7;
  date.setDate(date.getDate() - offset);
  return toDateKey(date);
}

/** Anonymous Gregorian algorithm. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}
