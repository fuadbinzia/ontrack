import type { Activity } from '@/types/models';
import { formatDuration, formatMinutes } from '@/utils/date';

type ActivityTiming = Pick<Activity, 'allDay' | 'startMinutes' | 'durationMinutes'>;

/** Human timing label that never invents a midnight time for all-day events. */
export function activityTimingLabel(activity: ActivityTiming) {
  return activity.allDay
    ? 'All day'
    : `${formatMinutes(activity.startMinutes)} · ${formatDuration(activity.durationMinutes)}`;
}
