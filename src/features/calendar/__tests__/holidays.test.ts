import {
  easterSunday,
  holidayDatesIn,
  holidayRegionFromLocale,
  holidaysForYear,
  holidaysOnDate,
} from '@/features/calendar/holidays';
import { toDateKey } from '@/utils/date';

describe('holidayRegionFromLocale', () => {
  it('reads a BCP-47 region and falls back to US for English without one', () => {
    expect(holidayRegionFromLocale('en-US')).toBe('US');
    expect(holidayRegionFromLocale('en_CA')).toBe('CA');
    expect(holidayRegionFromLocale('en-GB')).toBe('GB');
    expect(holidayRegionFromLocale('en-AU')).toBe('AU');
    expect(holidayRegionFromLocale('en-IE')).toBe('IE');
    expect(holidayRegionFromLocale('en')).toBe('US');
  });

  it('uses the common set for unsupported regions instead of US federal days', () => {
    expect(holidayRegionFromLocale('fr-FR')).toBe('common');
    expect(holidayRegionFromLocale('de-DE')).toBe('common');
  });
});

describe('US holidays 2026', () => {
  const namesOn = (date: string) =>
    holidaysOnDate(date, 'US').map((holiday) => holiday.name);

  it('stamps a stable slug so banners can pick a related icon', () => {
    const juneteenth = holidaysOnDate('2026-06-19', 'US').find(
      (holiday) => holiday.name === 'Juneteenth',
    );
    expect(juneteenth?.slug).toBe('juneteenth');
    expect(juneteenth?.id).toBe('US-juneteenth');
  });

  it('places federal and widely observed days on the Google-style dates', () => {
    expect(namesOn('2026-01-01')).toContain("New Year's Day");
    expect(namesOn('2026-01-19')).toContain('Martin Luther King Jr. Day');
    expect(namesOn('2026-02-16')).toContain("Presidents' Day");
    expect(namesOn('2026-05-25')).toContain('Memorial Day');
    expect(namesOn('2026-06-19')).toContain('Juneteenth');
    expect(namesOn('2026-07-04')).toContain('Independence Day');
    expect(namesOn('2026-09-07')).toContain('Labor Day');
    expect(namesOn('2026-10-12')).toContain('Indigenous Peoples’ Day');
    expect(namesOn('2026-11-11')).toContain('Veterans Day');
    expect(namesOn('2026-11-26')).toContain('Thanksgiving');
    expect(namesOn('2026-12-25')).toContain('Christmas Day');
  });

  it('adds an observed weekday when a federal holiday falls on a weekend', () => {
    expect(namesOn('2026-07-03')).toContain('Independence Day (Observed)');
    expect(namesOn('2026-07-04')).toContain('Independence Day');
  });

  it('places New Year’s observed on Dec 31 when Jan 1 is a Saturday', () => {
    expect(
      holidaysOnDate('2027-12-31', 'US').map((holiday) => holiday.name),
    ).toContain("New Year's Day (Observed)");
  });

  it('keeps cultural observances on the calendar without treating them as federal observed days', () => {
    expect(namesOn('2026-02-14')).toContain("Valentine's Day");
    expect(namesOn('2026-04-05')).toContain('Easter Sunday');
    expect(namesOn('2026-05-10')).toContain("Mother's Day");
    expect(namesOn('2026-06-21')).toContain("Father's Day");
    expect(namesOn('2026-10-31')).toContain('Halloween');
  });

  it('does not invent a holiday on an ordinary weekday', () => {
    expect(holidaysOnDate('2026-08-15', 'US')).toEqual([]);
  });
});

describe('other regions', () => {
  it('computes Canada Day and Canadian Thanksgiving', () => {
    expect(holidaysOnDate('2026-07-01', 'CA').map((h) => h.name)).toContain(
      'Canada Day',
    );
    expect(holidaysOnDate('2026-10-12', 'CA').map((h) => h.name)).toContain(
      'Thanksgiving',
    );
  });

  it('computes UK bank holidays and Ireland’s St. Patrick’s Day', () => {
    expect(holidaysOnDate('2026-05-04', 'GB').map((h) => h.name)).toContain(
      'Early May Bank Holiday',
    );
    expect(holidaysOnDate('2026-03-17', 'IE').map((h) => h.name)).toContain(
      "St. Patrick's Day",
    );
  });

  it('keeps an unsupported locale on a small common set', () => {
    const names = holidaysForYear(2026, 'common').map((holiday) => holiday.name);
    expect(names).toEqual(
      expect.arrayContaining(["New Year's Day", 'Christmas Day', "New Year's Eve"]),
    );
    expect(names).not.toContain('Independence Day');
    expect(names).not.toContain('Canada Day');
  });
});

describe('holidayDatesIn', () => {
  it('returns only dates that fall in the requested set', () => {
    const dates = holidayDatesIn(
      ['2026-07-03', '2026-07-04', '2026-07-05', '2026-08-15'],
      'US',
    );
    expect([...dates].sort()).toEqual(['2026-07-03', '2026-07-04']);
  });
});

describe('easterSunday', () => {
  it('matches known Western Easter dates', () => {
    expect(toDateKey(easterSunday(2025))).toBe('2025-04-20');
    expect(toDateKey(easterSunday(2026))).toBe('2026-04-05');
    expect(toDateKey(easterSunday(2027))).toBe('2027-03-28');
  });
});
