import { holidayMark } from '@/features/calendar/holiday-icon';
import { holidaysForYear } from '@/features/calendar/holidays';

describe('holidayMark', () => {
  it('uses a starred Christmas tree, not a park tree', () => {
    expect(holidayMark('christmas-day')).toBe('christmas-tree');
    expect(holidayMark('christmas-eve')).toBe('christmas-tree');
    expect(holidayMark('christmas-day')).not.toBe('tree');
  });

  it('gives each civic day its own silhouette', () => {
    expect(holidayMark('juneteenth')).toBe('burst-star');
    expect(holidayMark('independence-day')).toBe('fireworks');
    expect(holidayMark('canada-day')).toBe('maple');
    expect(holidayMark('australia-day')).toBe('southern-cross');
    expect(holidayMark({ slug: 'independence-day' })).not.toBe(
      holidayMark({ slug: 'juneteenth' }),
    );
  });

  it('picks a related mark for seasonal and family observances', () => {
    expect(holidayMark('valentines-day')).toBe('heart');
    expect(holidayMark('halloween')).toBe('pumpkin');
    expect(holidayMark('thanksgiving')).toBe('turkey');
    expect(holidayMark('st-patricks-day')).toBe('shamrock');
    expect(holidayMark('easter')).toBe('egg');
    expect(holidayMark('labor-day')).toBe('hammer');
    expect(holidayMark('boxing-day')).toBe('gift');
    expect(holidayMark('kings-birthday')).toBe('crown');
    expect(holidayMark('new-years-day')).toBe('party');
  });

  it('falls back to a calendar mark for an unknown slug', () => {
    expect(holidayMark('not-a-real-holiday')).toBe('calendar');
  });

  it('covers every shipped regional holiday slug', () => {
    const slugs = new Set(
      (['US', 'CA', 'GB', 'AU', 'IE', 'common'] as const).flatMap((region) =>
        holidaysForYear(2026, region).map((holiday) => holiday.slug),
      ),
    );
    for (const slug of slugs) {
      expect(holidayMark(slug)).not.toBe('calendar');
    }
  });
});
