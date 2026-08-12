import { activityBody, eventToActivity } from '@/services/calendar/google-mapping';
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
