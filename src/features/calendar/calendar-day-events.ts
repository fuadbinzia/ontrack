import type { Activity } from '@/types/models';

/** Selected-day activities in display order, without mutating persisted state. */
export function calendarActivitiesForDate(
  activitiesByDate: Readonly<Record<string, readonly Activity[]>>,
  date: string,
): Activity[] {
  return [...(activitiesByDate[date] ?? [])].sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );
}
