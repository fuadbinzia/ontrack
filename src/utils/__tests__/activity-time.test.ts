import { activityTimingLabel } from '@/utils/activity-time';

describe('activityTimingLabel', () => {
  it('labels all-day events without inventing a midnight time or duration', () => {
    expect(activityTimingLabel({
      allDay: true,
      startMinutes: 0,
      durationMinutes: 24 * 60,
    })).toBe('All day');
  });

  it('keeps the time and duration for ordinary timed events', () => {
    expect(activityTimingLabel({
      startMinutes: 9 * 60,
      durationMinutes: 60,
    })).toBe('9:00 AM · 1h');
  });

  it('recognizes a legacy Google whole-day record with no allDay field', () => {
    expect(activityTimingLabel({
      startMinutes: 0,
      durationMinutes: 24 * 60,
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'event-1',
        origin: 'google',
        lastSyncedAt: '2026-08-12T00:00:00.000Z',
      },
    })).toBe('All day');
  });

  it('does not reinterpret explicit timed or local midnight events as all-day', () => {
    const googleCalendar = {
      calendarId: 'primary',
      eventId: 'event-1',
      origin: 'google' as const,
      lastSyncedAt: '2026-08-12T00:00:00.000Z',
    };
    expect(activityTimingLabel({
      allDay: false,
      startMinutes: 0,
      durationMinutes: 24 * 60,
      googleCalendar,
    })).toBe('12:00 AM · 24h');
    expect(activityTimingLabel({
      startMinutes: 0,
      durationMinutes: 24 * 60,
    })).toBe('12:00 AM · 24h');
  });
});
