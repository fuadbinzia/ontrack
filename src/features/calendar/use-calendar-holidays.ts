import { useMemo } from 'react';

import { usePreferences } from '@/store/preferences';
import { monthGrid } from '@/utils/date';

import {
  holidayDatesIn,
  holidayRegionFromLocale,
  holidaysOnDate,
  type CalendarHoliday,
} from './holidays';

export function useHolidayRegion() {
  const locale = usePreferences((state) => state.dateLocale);
  return holidayRegionFromLocale(locale);
}

export function useCalendarHolidays(date: string): CalendarHoliday[] {
  const showHolidays = usePreferences((state) => state.showHolidays);
  const region = useHolidayRegion();
  return useMemo(() => {
    if (!showHolidays) return [];
    return holidaysOnDate(date, region);
  }, [date, region, showHolidays]);
}

export function useMonthHolidayDates(year: number, month: number): Set<string> {
  const showHolidays = usePreferences((state) => state.showHolidays);
  const region = useHolidayRegion();
  return useMemo(() => {
    if (!showHolidays) return new Set();
    return holidayDatesIn(
      monthGrid(year, month).map((cell) => cell.key),
      region,
    );
  }, [month, region, showHolidays, year]);
}
