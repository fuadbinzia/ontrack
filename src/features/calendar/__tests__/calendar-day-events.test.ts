import { calendarActivitiesForDate } from '@/features/calendar/calendar-day-events';
import type { Activity } from '@/types/models';

function activity(id: string, startMinutes: number): Activity {
  return {
    id,
    date: '2026-08-13',
    title: id,
    categoryId: 'event',
    startMinutes,
    durationMinutes: 60,
    status: 'upcoming',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('calendarActivitiesForDate', () => {
  it('returns all selected-day events in chronological order', () => {
    const late = activity('Dinner', 19 * 60);
    const early = activity('Breakfast', 8 * 60);

    expect(
      calendarActivitiesForDate({ '2026-08-13': [late, early] }, '2026-08-13'),
    ).toEqual([early, late]);
  });

  it('does not mutate the grouped schedule list while sorting', () => {
    const late = activity('Late', 900);
    const early = activity('Early', 300);
    const grouped = [late, early];

    calendarActivitiesForDate({ '2026-08-13': grouped }, '2026-08-13');

    expect(grouped).toEqual([late, early]);
  });

  it('returns an empty list when the selected day has no events', () => {
    expect(calendarActivitiesForDate({}, '2026-08-14')).toEqual([]);
  });
});
