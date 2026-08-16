import type { Activity } from '@/types/models';
import { isAllDayActivity } from '@/utils/activity-time';

export type AllDayCaption = 'Holiday' | 'Birthday' | 'All Day';

/** Selected-day activities in display order, without mutating persisted state. */
export function calendarActivitiesForDate(
  activitiesByDate: Readonly<Record<string, readonly Activity[]>>,
  date: string,
): Activity[] {
  return [...(activitiesByDate[date] ?? [])].sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );
}

export function isBirthdayTitle(title: string): boolean {
  return /\bbirthdays?\b/i.test(title);
}

export function allDayEventCaption(activity: Pick<Activity, 'title'>): AllDayCaption {
  return isBirthdayTitle(activity.title) ? 'Birthday' : 'All Day';
}

/** Timed timeline vs Google-style all-day rail. Does not mutate the input. */
export function splitDayActivities(activities: readonly Activity[]): {
  timed: Activity[];
  allDay: Activity[];
} {
  const timed: Activity[] = [];
  const allDay: Activity[] = [];
  for (const activity of activities) {
    if (isAllDayActivity(activity)) allDay.push(activity);
    else timed.push(activity);
  }
  return { timed, allDay };
}
