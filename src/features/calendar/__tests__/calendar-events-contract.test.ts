import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const calendar = readFileSync(
  join(process.cwd(), 'src/app/(tabs)/calendar.tsx'),
  'utf8',
);
const row = readFileSync(
  join(process.cwd(), 'src/features/calendar/calendar-event-row.tsx'),
  'utf8',
);

describe('calendar selected-day events', () => {
  it('renders every enabled selected-day activity below the day summary', () => {
    expect(calendar).toContain('timedActivities.map((activity) =>');
    expect(calendar).toContain('<CalendarEventRow');
    expect(calendar).toContain('testID={AgentUiIds.calendar.activity(activity.id)}');
  });

  it('uses the chronological selected-day event model', () => {
    expect(calendar).toContain('calendarActivitiesForDate(activitiesByDate, selected)');
  });

  it('shows each event title and its all-day-aware timing label', () => {
    expect(row).toContain('{activity.title}');
    expect(row).toContain('const timing = activityTimingLabel(activity)');
    expect(row).toContain('{timing}');
  });

  it('keeps holidays and all-day events on a static banner instead of CalendarEventRow', () => {
    expect(calendar).toContain('<HolidayBanner');
    expect(calendar).toContain('<AllDayActivityBanner');
    expect(calendar).toContain('timedActivities.map');
    expect(calendar).not.toMatch(/<CalendarEventRow[\s\S]*holiday=/);
    expect(calendar).not.toMatch(/<CalendarEventRow[\s\S]*allDay/);
  });
});
