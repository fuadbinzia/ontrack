import {
  emptyDayTitle,
  resolveDayTimeState,
} from '@/features/daily-tracking/day-view-model';
import type { Activity } from '@/types/models';

function activity(
  id: string,
  title: string,
  startMinutes: number,
  durationMinutes: number,
  status: Activity['status'] = 'upcoming',
): Activity {
  return {
    id,
    date: '2026-08-12',
    title,
    categoryId: 'habit',
    startMinutes,
    durationMinutes,
    status,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
  };
}

describe('resolveDayTimeState', () => {
  const now = new Date(2026, 7, 12, 10, 15);

  it('identifies the current activity from the supplied clock', () => {
    expect(
      resolveDayTimeState(
        [activity('current', 'Deep work', 600, 60)],
        '2026-08-12',
        now,
      ),
    ).toEqual({ currentId: 'current', nowLine: 'Now · Deep work' });
  });

  it('advances to the next upcoming activity and ignores finished statuses', () => {
    expect(
      resolveDayTimeState(
        [
          activity('done', 'Breakfast', 540, 30, 'completed'),
          activity('next', 'Lunch', 720, 30),
        ],
        '2026-08-12',
        now,
      ),
    ).toEqual({ nowLine: 'Next · Lunch' });
  });

  it('does not show live clock labels on another date', () => {
    expect(
      resolveDayTimeState(
        [activity('current', 'Deep work', 600, 60)],
        '2026-08-11',
        now,
      ),
    ).toEqual({});
  });

  it('does not treat an all-day event as happening now or as the next timed event', () => {
    const allDay = { ...activity('all-day', 'Conference', 0, 24 * 60), allDay: true };

    expect(resolveDayTimeState([allDay], '2026-08-12', now)).toEqual({});
    expect(
      resolveDayTimeState(
        [allDay, activity('next', 'Lunch', 720, 30)],
        '2026-08-12',
        now,
      ),
    ).toEqual({ nowLine: 'Next · Lunch' });
  });

  it('excludes a legacy Google all-day record before persistence migration runs', () => {
    const allDay = {
      ...activity('legacy-all-day', 'Conference', 0, 24 * 60),
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'event-1',
        origin: 'google' as const,
        lastSyncedAt: '2026-08-12T00:00:00.000Z',
      },
    };

    expect(resolveDayTimeState([allDay], '2026-08-12', now)).toEqual({});
  });
});

describe('emptyDayTitle', () => {
  it('uses tense that matches today, past, and future dates', () => {
    expect(emptyDayTitle('2026-08-12', '2026-08-12')).toBe('Today is wide open.');
    expect(emptyDayTitle('2026-08-11', '2026-08-12')).toBe('This day was wide open.');
    expect(emptyDayTitle('2026-08-13', '2026-08-12')).toBe('This day is wide open.');
  });
});
