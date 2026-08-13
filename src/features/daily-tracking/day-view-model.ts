import type { Activity } from '@/types/models';
import { toDateKey } from '@/utils/date';

export interface DayTimeState {
  currentId?: string;
  nowLine?: string;
}

/** Clock-driven labels for the selected day. */
export function resolveDayTimeState(
  activities: Activity[],
  date: string,
  now = new Date(),
): DayTimeState {
  if (date !== toDateKey(now)) return {};

  const minutes = now.getHours() * 60 + now.getMinutes();
  const current = activities.find(
    (activity) =>
      !activity.allDay &&
      activity.status === 'upcoming' &&
      activity.startMinutes <= minutes &&
      minutes < activity.startMinutes + activity.durationMinutes,
  );
  if (current) {
    return {
      currentId: current.id,
      nowLine: `Now · ${current.title}`,
    };
  }

  const next = activities.find(
    (activity) =>
      !activity.allDay &&
      activity.status === 'upcoming' && activity.startMinutes > minutes,
  );
  return next ? { nowLine: `Next · ${next.title}` } : {};
}

export function emptyDayTitle(
  date: string,
  today = toDateKey(new Date()),
): string {
  if (date === today) return 'Today is wide open.';
  return date < today ? 'This day was wide open.' : 'This day is wide open.';
}
