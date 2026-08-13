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
});
