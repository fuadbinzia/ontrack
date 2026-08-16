import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('holiday banners stay off the user timeline', () => {
  it('renders a static glass rail with no complete toggle or chevron', () => {
    const holiday = read('src/features/calendar/holiday-banner.tsx');
    const banner = read('src/features/calendar/all-day-banner.tsx');
    expect(holiday).toContain('caption="Holiday"');
    expect(holiday).toContain('HolidayMark');
    expect(holiday).toContain('iconNode');
    expect(holiday).not.toContain('icon="habit"');
    expect(holiday).not.toContain('holidayIcon');
    expect(holiday).not.toContain('onPress');
    expect(banner).toContain('GlassPlate');
    expect(banner).toContain('GlassIconWell');
    expect(banner).toContain("caption === 'Birthday'");
    expect(banner).not.toContain('Card');
    expect(banner).not.toContain('chevron-right');
    expect(banner).not.toContain('backgroundElevated');
    expect(banner).not.toContain('backgroundSunken');
    expect(banner).not.toContain("overflow: 'hidden'");
  });

  it('keeps Today holidays and all-day events in the header rail, not FlashList rows', () => {
    const dayView = read('src/features/daily-tracking/day-view.tsx');
    expect(dayView).toContain('splitDayActivities(enabledActivities)');
    expect(dayView).toContain('useCalendarHolidays(date)');
    expect(dayView).toContain('<HolidayBanner');
    expect(dayView).toContain('<AllDayActivityBanner');
    expect(dayView).toContain('AgentUiIds.today.holiday(holiday.id)');
    expect(dayView).toContain('AgentUiIds.today.allDay(activity.id)');
    expect(dayView).toContain('data={activities}');
    expect(dayView).toContain('styles.holidayRail');
    expect(dayView).not.toMatch(/data=\{[^}]*allDayActivities/);
  });

  it('lists Calendar holidays and all-day events above timed rows without counting them as lined-up things', () => {
    const calendar = read('src/app/(tabs)/calendar.tsx');
    expect(calendar).toContain('splitDayActivities(dayActivities)');
    expect(calendar).toContain('const dayCount = timedActivities.length');
    expect(calendar).toContain('<HolidayBanner');
    expect(calendar).toContain('<AllDayActivityBanner');
    expect(calendar).toContain('AgentUiIds.calendar.holiday(holiday.id)');
    expect(calendar).toContain('AgentUiIds.calendar.allDay(activity.id)');
    expect(calendar.indexOf('dayHolidays.map')).toBeLessThan(
      calendar.indexOf('timedActivities.map'),
    );
    expect(calendar.indexOf('allDayActivities.map')).toBeLessThan(
      calendar.indexOf('timedActivities.map'),
    );
    expect(calendar).toContain('holidayDates={holidayDates}');
  });

  it('marks holiday days on the month grid without using the activity completion dot', () => {
    const grid = read('src/features/calendar/month-grid.tsx');
    expect(grid).toContain('holidayDates');
    expect(grid).toContain('styles.holidayMark');
    expect(grid).toContain('holiday={Boolean(holidayDates?.has(cell.key))}');
  });
});
