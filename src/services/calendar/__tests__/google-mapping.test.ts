import {
  activityBody,
  eventToActivity,
  googleCalendarMetadata,
  googleEventAllDay,
  googleEventMatchesActivity,
} from '@/services/calendar/google-mapping';
import type { GoogleCalendarLinkRow } from '@/services/calendar/google-types';
import type { Activity } from '@/types/models';

const syncedAt = '2026-08-12T12:00:00.000Z';
const link: GoogleCalendarLinkRow = {
  user_id: 'user-1',
  calendar_id: 'primary',
  google_event_id: 'event-1',
  activity_id: 'activity-1',
  origin: 'google',
  google_updated_at: syncedAt,
  local_updated_at: syncedAt,
  created_at: syncedAt,
};

it('uses the exclusive Google end date for multi-day all-day events', () => {
  const activity = eventToActivity(
    {
      id: 'event-1',
      summary: 'Conference',
      start: { date: '2026-08-12' },
      end: { date: '2026-08-15' },
    },
    undefined,
    link,
    'America/New_York',
    syncedAt,
  );

  expect(activity).toMatchObject({
    date: '2026-08-12',
    allDay: true,
    startMinutes: 0,
    durationMinutes: 3 * 24 * 60,
  });
});

it('keeps one-day and malformed all-day ranges at a safe one-day minimum', () => {
  const oneDay = eventToActivity(
    { start: { date: '2026-08-12' }, end: { date: '2026-08-13' } },
    undefined,
    link,
    'UTC',
    syncedAt,
  );
  const reversed = eventToActivity(
    { start: { date: '2026-08-12' }, end: { date: '2026-08-11' } },
    undefined,
    link,
    'UTC',
    syncedAt,
  );

  expect(oneDay.durationMinutes).toBe(24 * 60);
  expect(reversed.durationMinutes).toBe(24 * 60);
});

it('preserves the recurring-series identity on imported Google occurrences', () => {
  const activity = eventToActivity(
    {
      id: 'occurrence-1',
      recurringEventId: 'weekly-series-1',
      summary: 'Team sync',
      start: { dateTime: '2026-08-12T10:00:00-04:00' },
      end: { dateTime: '2026-08-12T10:30:00-04:00' },
    },
    undefined,
    link,
    'America/New_York',
    syncedAt,
  );

  expect(activity.googleCalendar).toEqual(expect.objectContaining({
    eventId: 'event-1',
    recurringEventId: 'weekly-series-1',
  }));
});

it('does not mark an ordinary Google event as recurring', () => {
  const activity = eventToActivity(
    { id: 'event-1', start: { date: '2026-08-12' }, end: { date: '2026-08-13' } },
    undefined,
    link,
    'UTC',
    syncedAt,
  );

  expect(activity.googleCalendar).not.toHaveProperty('recurringEventId');
});

it('keeps series identity while refreshing link metadata after local edits', () => {
  expect(googleCalendarMetadata(link, syncedAt, 'weekly-series-1')).toEqual({
    calendarId: 'primary',
    eventId: 'event-1',
    recurringEventId: 'weekly-series-1',
    origin: 'google',
    lastSyncedAt: syncedAt,
  });
});

it('reads date-only shape independently from Google content timestamps', () => {
  expect(googleEventAllDay({ start: { date: '2026-08-12' } })).toBe(true);
  expect(googleEventAllDay({ start: { dateTime: '2026-08-12T00:00:00Z' } })).toBeUndefined();
});

it('exports timed activities across midnight without losing the next date', () => {
  const activity: Activity = {
    id: 'activity-1',
    date: '2026-08-12',
    title: 'Late shift',
    categoryId: 'work',
    startMinutes: 23 * 60 + 30,
    durationMinutes: 120,
    status: 'upcoming',
    createdAt: syncedAt,
    updatedAt: syncedAt,
  };

  expect(activityBody(activity, 'America/New_York')).toMatchObject({
    start: { dateTime: '2026-08-12T23:30:00' },
    end: { dateTime: '2026-08-13T01:30:00' },
  });
});

it('exports all-day activities with date-only boundaries and no invented time', () => {
  const activity: Activity = {
    id: 'activity-all-day',
    date: '2026-08-12',
    allDay: true,
    title: 'Conference',
    categoryId: 'personal',
    startMinutes: 0,
    durationMinutes: 3 * 24 * 60,
    status: 'upcoming',
    createdAt: syncedAt,
    updatedAt: syncedAt,
  };

  expect(activityBody(activity, 'America/New_York')).toMatchObject({
    start: { date: '2026-08-12' },
    end: { date: '2026-08-15' },
  });
  expect(activityBody(activity, 'America/New_York')).not.toHaveProperty('start.dateTime');
});

it('matches Google-visible content independently from local-only activity fields', () => {
  const activity: Activity = {
    id: 'activity-1',
    date: '2026-08-12',
    title: 'Therapy',
    notes: 'Weekly appointment',
    categoryId: 'health',
    startMinutes: 14 * 60,
    durationMinutes: 60,
    status: 'completed',
    photo: 'local-only-photo',
    createdAt: syncedAt,
    updatedAt: '2026-08-13T12:00:00.000Z',
  };
  const event = {
    summary: 'Therapy',
    description: 'Weekly appointment',
    start: { dateTime: '2026-08-12T14:00:00-04:00' },
    end: { dateTime: '2026-08-12T15:00:00-04:00' },
  };

  expect(googleEventMatchesActivity(event, activity, 'America/New_York')).toBe(true);
  expect(googleEventMatchesActivity(
    { ...event, end: { dateTime: '2026-08-12T15:30:00-04:00' } },
    activity,
    'America/New_York',
  )).toBe(false);
});

it('matches all-day content by exclusive date boundaries', () => {
  const activity: Activity = {
    id: 'activity-all-day', date: '2026-08-12', allDay: true, title: 'Conference',
    categoryId: 'personal', startMinutes: 0, durationMinutes: 2 * 24 * 60,
    status: 'upcoming', createdAt: syncedAt, updatedAt: syncedAt,
  };

  expect(googleEventMatchesActivity({
    summary: 'Conference', start: { date: '2026-08-12' }, end: { date: '2026-08-14' },
  }, activity, 'UTC')).toBe(true);
  expect(googleEventMatchesActivity({
    summary: 'Conference', start: { date: '2026-08-12' }, end: { date: '2026-08-13' },
  }, activity, 'UTC')).toBe(false);
});
