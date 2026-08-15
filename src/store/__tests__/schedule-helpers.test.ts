import type { Activity } from '@/types/models';

import {
  activitySeriesId,
  appendCalendarDeletions,
  calendarDeletion,
  migrateLegacyGoogleAllDayActivities,
  stripLegacySeedData,
} from '../schedule-helpers';

const activity = (id: string, extra: Partial<Activity> = {}): Activity => ({
  id,
  date: '2026-08-15',
  title: 'Event',
  categoryId: 'event',
  startMinutes: 0,
  durationMinutes: 60,
  status: 'upcoming',
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
  ...extra,
});

describe('schedule helpers', () => {
  it('strips legacy seed-* activities and their detail rows', () => {
    const kept = activity('real-1');
    const seeded = activity('seed-2');
    expect(
      stripLegacySeedData({
        activities: [kept, seeded],
        meals: [
          { activityId: 'real-1', mealType: 'lunch', name: 'Kept', items: [] },
          { activityId: 'seed-2', mealType: 'lunch', name: 'Seed', items: [] },
        ],
        workouts: [],
        workSessions: [],
      }),
    ).toEqual({
      activities: [kept],
      meals: [{ activityId: 'real-1', mealType: 'lunch', name: 'Kept', items: [] }],
      workouts: [],
      workSessions: [],
    });
  });

  it('leaves non-seed schedules untouched', () => {
    const state = { activities: [activity('real-1')] };
    expect(stripLegacySeedData(state)).toBe(state);
  });

  it('records google calendar deletions for removed linked events', () => {
    const linked = activity('cal-1', {
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'evt-1',
        origin: 'google',
        lastSyncedAt: '2026-08-15T12:00:00.000Z',
      },
    });
    expect(calendarDeletion(activity('local-1'))).toBeUndefined();
    expect(appendCalendarDeletions([], [linked, activity('local-2')])).toEqual([
      {
        activityId: 'cal-1',
        calendarId: 'primary',
        eventId: 'evt-1',
        origin: 'google',
      },
    ]);
  });

  it('migrates implicit all-day google events once', () => {
    const implicit = activity('all-day', {
      startMinutes: 0,
      durationMinutes: 1440,
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'evt-all',
        origin: 'google',
        lastSyncedAt: '2026-08-15T12:00:00.000Z',
      },
    });
    const already = activity('marked', { allDay: false, startMinutes: 540, durationMinutes: 30 });
    const migrated = migrateLegacyGoogleAllDayActivities([implicit, already]);
    expect(migrated[0]).toMatchObject({ id: 'all-day', allDay: true });
    expect(migrated[1]).toBe(already);
    expect(migrateLegacyGoogleAllDayActivities(migrated)).toBe(migrated);
  });

  it('identifies google and onTrack series ids', () => {
    expect(activitySeriesId(undefined)).toBeUndefined();
    expect(
      activitySeriesId(
        activity('g', {
          googleCalendar: {
            calendarId: 'primary',
            eventId: 'evt-1',
            origin: 'google',
            lastSyncedAt: '2026-08-15T12:00:00.000Z',
            recurringEventId: 'series-9',
          },
        }),
      ),
    ).toBe('google:primary:series-9');
    expect(
      activitySeriesId(
        activity('o', { recurrence: { frequency: 'weekly', seriesId: 'abc' } }),
      ),
    ).toBe('ontrack:abc');
  });
});
