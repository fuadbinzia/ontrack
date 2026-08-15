import type { GoogleCalendarDeletion } from '@/services/calendar/google-types';
import type { Activity } from '@/types/models';
import { isAllDayActivity } from '@/utils/activity-time';

import type { ScheduleState } from './schedule-types';

const seedPattern = /^seed-\d+$/;

interface ScheduleSeedData {
  activities?: Activity[];
  meals?: ScheduleState['meals'];
  workouts?: ScheduleState['workouts'];
  workSessions?: ScheduleState['workSessions'];
}

export function stripLegacySeedData(state: ScheduleSeedData) {
  const activities = state.activities ?? [];
  const seedIds = new Set(
    activities
      .filter((activity) => seedPattern.test(activity.id))
      .map((activity) => activity.id),
  );
  if (seedIds.size === 0) return state;

  return {
    ...state,
    activities: activities.filter((activity) => !seedPattern.test(activity.id)),
    meals: (state.meals ?? []).filter((meal) => !seedIds.has(meal.activityId)),
    workouts: (state.workouts ?? []).filter((workout) => !seedIds.has(workout.activityId)),
    workSessions: (state.workSessions ?? []).filter(
      (session) => !seedIds.has(session.activityId),
    ),
  };
}

export function calendarDeletion(activity: Activity): GoogleCalendarDeletion | undefined {
  const metadata = activity.googleCalendar;
  return metadata ? {
    activityId: activity.id,
    calendarId: metadata.calendarId,
    eventId: metadata.eventId,
    origin: metadata.origin,
  } : undefined;
}

export function appendCalendarDeletions(
  current: GoogleCalendarDeletion[],
  removed: Activity[],
) {
  const next = new Map(current.map((deletion) => [deletion.activityId, deletion]));
  removed.forEach((activity) => {
    const deletion = calendarDeletion(activity);
    if (deletion) next.set(deletion.activityId, deletion);
  });
  return [...next.values()];
}

export function activitySeriesId(activity: Activity | undefined) {
  if (!activity) return undefined;
  if (activity.googleCalendar?.recurringEventId) {
    return `google:${activity.googleCalendar.calendarId}:${activity.googleCalendar.recurringEventId}`;
  }
  return activity.recurrence?.seriesId
    ? `ontrack:${activity.recurrence.seriesId}`
    : undefined;
}

export function cloneEventDetail<T extends { activityId: string }>(detail: T, activityId: string): T {
  const cloned = { ...detail, activityId } as T & {
    items?: unknown[];
    exercises?: { sets: unknown[] }[];
    tasks?: unknown[];
    genres?: string[];
  };
  if (cloned.items) cloned.items = cloned.items.map((item) => ({ ...(item as object) }));
  if (cloned.exercises) {
    cloned.exercises = cloned.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...(set as object) })),
    }));
  }
  if (cloned.tasks) cloned.tasks = cloned.tasks.map((task) => ({ ...(task as object) }));
  if (cloned.genres) cloned.genres = [...cloned.genres];
  return cloned;
}

export function migrateLegacyGoogleAllDayActivities(activities: Activity[]) {
  let changed = false;
  const migrated = activities.map((activity) => {
    if (activity.allDay !== undefined || !isAllDayActivity(activity)) return activity;
    changed = true;
    return { ...activity, allDay: true };
  });
  return changed ? migrated : activities;
}

export function selectActivitiesForDate(state: ScheduleState, date: string): Activity[] {
  return state.activities
    .filter((a) => a.date === date)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function selectActivitiesByDate(state: ScheduleState): Record<string, Activity[]> {
  const map: Record<string, Activity[]> = {};
  for (const a of state.activities) {
    (map[a.date] ??= []).push(a);
  }
  return map;
}
