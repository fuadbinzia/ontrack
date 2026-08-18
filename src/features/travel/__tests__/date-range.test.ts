import {
    daysUntilDate,
    tripDatesBadge,
    tripDayCount,
    validateTravelDateRange,
} from '../date-range';
import type { TravelItineraryItem } from '../types';

const FLIGHT: TravelItineraryItem = {
  id: 'flight-1',
  kind: 'flight',
  title: 'Flight home',
  date: '2026-09-14',
  startMinutes: 600,
  durationMinutes: 180,
};

describe('tripDayCount', () => {
  it('counts inclusive calendar days', () => {
    expect(tripDayCount('2026-09-08', '2026-09-14')).toBe(7);
  });

  it('treats same-day trips as 1 day', () => {
    expect(tripDayCount('2026-09-08', '2026-09-08')).toBe(1);
  });
});

describe('tripDatesBadge', () => {
  it('shows days until an upcoming trip starts', () => {
    const now = new Date(2026, 7, 5, 12, 0, 0); // Aug 5 local
    expect(daysUntilDate('2026-09-27', now)).toBe(53);
    expect(tripDatesBadge('2026-09-27', '2026-09-30', now)).toEqual({
      kind: 'label',
      label: 'In 53 Days',
    });
  });

  it('uses Tomorrow the day before start', () => {
    expect(
      tripDatesBadge('2026-09-27', '2026-09-30', new Date(2026, 8, 26, 9, 0, 0)),
    ).toEqual({ kind: 'label', label: 'Tomorrow' });
  });

  it('shows inclusive days left once the trip has started', () => {
    expect(
      tripDatesBadge('2026-09-27', '2026-09-30', new Date(2026, 8, 27, 9, 0, 0)),
    ).toEqual({ kind: 'label', label: '4 Days Left' });
    expect(
      tripDatesBadge('2026-09-27', '2026-09-30', new Date(2026, 8, 28, 12, 0, 0)),
    ).toEqual({ kind: 'label', label: '3 Days Left' });
    expect(
      tripDatesBadge('2026-09-27', '2026-09-30', new Date(2026, 8, 30, 12, 0, 0)),
    ).toEqual({ kind: 'label', label: '1 Day Left' });
  });

  it('marks the badge complete after the end date', () => {
    expect(
      tripDatesBadge('2026-09-27', '2026-09-30', new Date(2026, 9, 1, 9, 0, 0)),
    ).toEqual({ kind: 'complete' });
  });
});

describe('travel date range validation', () => {
  it('accepts a valid range containing the itinerary', () => {
    expect(validateTravelDateRange('2026-09-08', '2026-09-14', [FLIGHT])).toEqual({
      conflicts: [],
    });
  });

  it('rejects a return before departure', () => {
    expect(validateTravelDateRange('2026-09-15', '2026-09-14').error).toBe(
      'The return date needs to be on or after departure.',
    );
  });

  it('identifies itinerary items outside a shortened range', () => {
    const result = validateTravelDateRange('2026-09-08', '2026-09-12', [FLIGHT]);

    expect(result.conflicts).toEqual([FLIGHT]);
    expect(result.error).toContain('Flight home');
  });

  it('allows moments outside the trip window when shortening dates', () => {
    const moment: TravelItineraryItem = {
      id: 'm1',
      kind: 'moment',
      title: 'Prep',
      date: '2026-09-01',
      startMinutes: 600,
      durationMinutes: 15,
    };
    expect(
      validateTravelDateRange('2026-09-08', '2026-09-14', [moment, FLIGHT]),
    ).toEqual({ conflicts: [] });
  });
});
