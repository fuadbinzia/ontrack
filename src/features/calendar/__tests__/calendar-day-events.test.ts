import {
  allDayEventCaption,
  calendarActivitiesForDate,
  isBirthdayTitle,
  splitDayActivities,
} from '@/features/calendar/calendar-day-events';
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

  it('does not treat holidays as schedule activities', () => {
    expect(calendarActivitiesForDate({ '2026-07-04': [] }, '2026-07-04')).toEqual(
      [],
    );
  });
});

describe('splitDayActivities', () => {
  it('lifts all-day and birthday events off the timed timeline', () => {
    const lunch = activity('Lunch', 12 * 60);
    const birthday = {
      ...activity("Alex's Birthday", 0),
      allDay: true,
      durationMinutes: 24 * 60,
    };
    const conference = {
      ...activity('Conference', 0),
      allDay: true,
      durationMinutes: 24 * 60,
    };

    expect(splitDayActivities([conference, lunch, birthday])).toEqual({
      timed: [lunch],
      allDay: [conference, birthday],
    });
  });

  it('does not mutate the source list while splitting', () => {
    const lunch = activity('Lunch', 720);
    const birthday = { ...activity('Birthday', 0), allDay: true };
    const source = [birthday, lunch];

    splitDayActivities(source);

    expect(source).toEqual([birthday, lunch]);
  });

  it('treats a legacy Google midnight whole-day record as all-day', () => {
    const legacy = {
      ...activity('Conference', 0),
      durationMinutes: 24 * 60,
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'event-1',
        origin: 'google' as const,
        lastSyncedAt: '2026-08-12T00:00:00.000Z',
      },
    };

    expect(splitDayActivities([legacy]).allDay).toEqual([legacy]);
  });
});

describe('all-day captions', () => {
  it('labels birthdays separately from other all-day events', () => {
    expect(isBirthdayTitle("Alex's Birthday")).toBe(true);
    expect(isBirthdayTitle('Team birthdays')).toBe(true);
    expect(isBirthdayTitle('Conference')).toBe(false);
    expect(allDayEventCaption({ title: "Jordan's Birthday" })).toBe('Birthday');
    expect(allDayEventCaption({ title: 'Team Offsite' })).toBe('All Day');
  });
});
