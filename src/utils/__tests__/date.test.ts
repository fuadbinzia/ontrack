import {
    dateDisplayFormatForLocale,
    formatDateKey,
    formatDateKeyMedium,
    formatDateKeyShort,
    formatDateLong,
    formatDatePickerTitle,
    formatMonthTitle,
    formatTimePickerTitle,
    formatTripDateRangeLabel,
    formatTripWeekdayRangeLabel,
    fromDateKey,
    isDateKey,
    nativeDatePickerLocale,
    toDateKey,
} from '@/utils/date';

describe('date keys', () => {
  it('round trips valid local calendar dates', () => {
    expect(toDateKey(fromDateKey('2028-02-29'))).toBe('2028-02-29');
  });

  it('rejects impossible and malformed dates', () => {
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('07/26/2026')).toBe(false);
  });

  it('uses month-first display only for locales that prefer it', () => {
    expect(dateDisplayFormatForLocale('en-US')).toBe('mdy');
    expect(dateDisplayFormatForLocale('en-PH')).toBe('mdy');
    expect(dateDisplayFormatForLocale('en-CA')).toBe('iso');
    expect(dateDisplayFormatForLocale('en-GB')).toBe('iso');
  });

  it('changes presentation without changing the stored date key', () => {
    const stored = '2026-07-26';
    expect(formatDateKey(stored, 'mdy')).toBe('7/26/26');
    expect(formatDateKey(stored, 'iso')).toBe('26-07-26');
    expect(stored).toBe('2026-07-26');
  });

  it('keeps the full year in calendar picker month titles', () => {
    expect(formatMonthTitle(2026, 8)).toBe('September 2026');
  });

  it('formats long dates with an optional year', () => {
    expect(formatDateLong('2026-08-10')).toBe('August 10');
    expect(formatDateLong('2026-08-10', { year: true })).toBe('August 10, 2026');
  });

  it('formats short timeline dates without year or leading zeros', () => {
    expect(formatDateKeyShort('2026-09-08', 'mdy')).toBe('9/8');
    expect(formatDateKeyShort('2026-09-08', 'iso')).toBe('8/9');
    expect(formatDateKeyShort('2026-12-31', 'mdy')).toBe('12/31');
  });

  it('formats medium and trip-range chrome dates', () => {
    expect(formatDateKeyMedium('2026-09-08')).toBe('Sep 8');
    expect(formatTripDateRangeLabel('2026-09-08', '2026-09-14')).toBe(
      'Sep 8 – Sep 14, 2026',
    );
    expect(formatTripWeekdayRangeLabel('2026-09-08', '2026-09-14')).toBe(
      'Tuesday – Monday',
    );
    expect(formatTripDateRangeLabel('2025-12-30', '2026-01-02')).toBe(
      'Dec 30, 2025 – Jan 2, 2026',
    );
  });

  it('handles legacy preferences without a native picker locale', () => {
    expect(nativeDatePickerLocale(undefined)).toBeUndefined();
    expect(nativeDatePickerLocale('system')).toBeUndefined();
    expect(nativeDatePickerLocale('en-US')).toBe('en_US');
  });

  it('keeps accessibility requirements out of visible picker titles', () => {
    expect(formatDatePickerTitle('Depart date, required')).toBe('Depart Date');
    expect(formatDatePickerTitle('Return date, optional')).toBe('Return Date');
    expect(formatDatePickerTitle('Date of Birth')).toBe('Date of Birth');
  });

  it('keeps accessibility requirements out of visible time picker titles', () => {
    expect(formatTimePickerTitle('Arrival time, required')).toBe('Arrival Time');
    expect(formatTimePickerTitle('Check-out time, optional')).toBe('Check-out Time');
  });
});
