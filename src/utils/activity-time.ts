import type { Activity } from '@/types/models';
import { formatDuration, formatMinutes } from '@/utils/date';

type ActivityTiming = Pick<
  Activity,
  'allDay' | 'startMinutes' | 'durationMinutes' | 'googleCalendar'
>;

/**
 * Legacy Google all-day imports were stored as midnight + whole-day duration
 * before `allDay` existed. Explicit true/false always wins over that fallback.
 */
export function isAllDayActivity(activity: ActivityTiming) {
  if (activity.allDay !== undefined) return activity.allDay;
  return Boolean(
    activity.googleCalendar
      && activity.startMinutes === 0
      && activity.durationMinutes >= 24 * 60
      && activity.durationMinutes % (24 * 60) === 0,
  );
}

/** Human timing label that never invents a midnight time for all-day events. */
export function activityTimingLabel(activity: ActivityTiming) {
  return isAllDayActivity(activity)
    ? 'All day'
    : `${formatMinutes(activity.startMinutes)} · ${formatDuration(activity.durationMinutes)}`;
}
