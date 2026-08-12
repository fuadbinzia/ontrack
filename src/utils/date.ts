import { getDateTimeFormatter } from '@/utils/intl-cache';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Locale identifier used to render a stored date key for the current device. */
export type DateDisplayFormat = string;

/** YYYY-MM-DD in local time. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = fromDateKey(value);
  return !Number.isNaN(parsed.valueOf()) && toDateKey(parsed) === value;
}

export function deviceLocale(): string {
  try {
    const formatter = Intl.DateTimeFormat();
    if (typeof formatter.resolvedOptions === 'function') {
      return formatter.resolvedOptions().locale || 'system';
    }
  } catch {
    // Older Hermes runtimes still support Date#toLocaleDateString but may not
    // expose the complete Intl formatter API.
  }
  return 'system';
}

export function dateDisplayFormatForLocale(locale?: string): DateDisplayFormat {
  try {
    return getDateTimeFormatter(locale === 'system' ? undefined : locale)
      .resolvedOptions().locale || 'system';
  } catch {
    return 'system';
  }
}

function dateFormatter(locale: DateDisplayFormat): Intl.DateTimeFormat {
  return getDateTimeFormatter(locale === 'system' ? undefined : locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

export function usesMonthFirstDateFormat(locale: DateDisplayFormat): boolean {
  try {
    return dateFormatter(locale).formatToParts(new Date(2006, 10, 22, 12))
      .find((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
      ?.type === 'month';
  } catch {
    return false;
  }
}

export function datePlaceholderForLocale(locale: DateDisplayFormat): string {
  try {
    return dateFormatter(locale)
      .formatToParts(new Date(2006, 10, 22, 12))
      .map((part) => {
        if (part.type === 'day') return 'DD';
        if (part.type === 'month') return 'MM';
        if (part.type === 'year') return 'YYYY';
        return part.value;
      })
      .join('');
  } catch {
    return 'YYYY-MM-DD';
  }
}

export function nativeDatePickerLocale(locale: unknown): string | undefined {
  return typeof locale === 'string' && locale !== 'system'
    ? locale.replace('-', '_')
    : undefined;
}

export function formatDateKey(value: string, format: DateDisplayFormat): string {
  if (!isDateKey(value)) return value;
  try {
    return dateFormatter(format).format(fromDateKey(value));
  } catch {
    return value;
  }
}

/** Visible calendar-sheet title derived from a spoken accessibility label. */
export function formatDatePickerTitle(label: string): string {
  return label
    .replace(/,\s*(?:required|optional)\s*$/i, '')
    .replace(/\bdate\b/gi, 'Date');
}

/** Visible time-picker title derived from a spoken accessibility label. */
export function formatTimePickerTitle(label: string): string {
  return label
    .replace(/,\s*(?:required|optional)\s*$/i, '')
    .replace(/\btime\b/gi, 'Time');
}

/** Month/day (or day/month) without year or leading zeros — for dense timeline chrome. */
export function formatDateKeyShort(value: string, format: DateDisplayFormat): string {
  if (!isDateKey(value)) return value;
  try {
    return getDateTimeFormatter(format === 'system' ? undefined : format, {
      day: 'numeric',
      month: 'numeric',
    }).format(fromDateKey(value));
  } catch {
    return value;
  }
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Medium calendar chrome: `Sep 27`. */
export function formatDateKeyMedium(value: string): string {
  if (!isDateKey(value)) return value;
  const d = fromDateKey(value);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Trip date-range chrome: `Sep 8 – Sep 14, 2026` (en dash; year once when shared).
 */
export function formatTripDateRangeLabel(startDate: string, endDate: string): string {
  if (!isDateKey(startDate) || !isDateKey(endDate)) {
    return `${startDate} – ${endDate}`;
  }
  const start = fromDateKey(startDate);
  const end = fromDateKey(endDate);
  const startLabel = formatDateKeyMedium(startDate);
  const endLabel = formatDateKeyMedium(endDate);
  if (start.getFullYear() === end.getFullYear()) {
    return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
  }
  return `${startLabel}, ${start.getFullYear()} – ${endLabel}, ${end.getFullYear()}`;
}

/** Weekday range chrome: `Tuesday – Monday`. */
export function formatTripWeekdayRangeLabel(startDate: string, endDate: string): string {
  if (!isDateKey(startDate) || !isDateKey(endDate)) return '';
  return `${formatWeekday(startDate)} – ${formatWeekday(endDate)}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function isToday(key: string): boolean {
  return key === todayKey();
}

export function isPast(key: string): boolean {
  return key < todayKey();
}

/** 12-hour clock with minutes always shown (e.g. `9:00 AM`, `6:30 PM`). */
export function formatMinutes(minutesFromMidnight: number): string {
  const h24 = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${`${m}`.padStart(2, '0')} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Whole minutes from a local start date/time to a local end date/time. */
export function minutesBetween(
  startDate: string,
  startMinutes: number,
  endDate: string,
  endMinutes: number,
): number {
  if (!isDateKey(startDate) || !isDateKey(endDate)) return NaN;
  const start = fromDateKey(startDate);
  start.setHours(0, 0, 0, 0);
  const end = fromDateKey(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 60_000) + (endMinutes - startMinutes);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDateLong(
  key: string,
  options?: { year?: boolean },
): string {
  const d = fromDateKey(key);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return options?.year ? `${base}, ${d.getFullYear()}` : base;
}

/** Plant watering / care due chip: Overdue, Due today, or Due {date}. */
export function formatDueLabel(dueKey: string, options?: { overduePrefix?: string }): string {
  if (isPast(dueKey)) {
    return options?.overduePrefix
      ? `${options.overduePrefix} ${formatDateLong(dueKey)}`
      : 'Overdue';
  }
  if (isToday(dueKey)) return 'Due today';
  return `Due ${formatDateLong(dueKey)}`;
}

export function formatWeekday(key: string): string {
  return WEEKDAYS[fromDateKey(key).getDay()];
}

export function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Minutes elapsed since local midnight for "now". */
export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export interface CalendarCell {
  key: string;
  day: number;
  inMonth: boolean;
}

/** 6x7 grid of cells for a month view, weeks starting Sunday. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ key: toDateKey(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}
