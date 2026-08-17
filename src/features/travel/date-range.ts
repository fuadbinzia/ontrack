import { fromDateKey, isDateKey, toDateKey } from '@/utils/date';
import type { TravelItineraryItem } from './types';

export interface TravelDateRangeValidation {
  error?: string;
  conflicts: TravelItineraryItem[];
}

/** Inclusive trip length in calendar days (same start/end = 1). */
export function tripDayCount(startDate: string, endDate: string): number {
  const start = fromDateKey(startDate).getTime();
  const end = fromDateKey(endDate).getTime();
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

/** Whole calendar days from local today until `targetDate` (negative if past). */
export function daysUntilDate(targetDate: string, now: Date = new Date()): number {
  const start = fromDateKey(toDateKey(now)).getTime();
  const target = fromDateKey(targetDate).getTime();
  return Math.round((target - start) / (24 * 60 * 60 * 1000));
}

export type TripDatesBadge =
  | { kind: 'label'; label: string }
  | { kind: 'complete' };

/**
 * Compact itinerary dates-row status pill (shown right of trip length):
 * - before start → countdown
 * - during trip → inclusive days left
 * - after end → complete (checkmark in UI)
 */
export function tripDatesBadge(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): TripDatesBadge {
  const untilStart = daysUntilDate(startDate, now);
  if (untilStart > 1) return { kind: 'label', label: `In ${untilStart} Days` };
  if (untilStart === 1) return { kind: 'label', label: 'Tomorrow' };

  const untilEnd = daysUntilDate(endDate, now);
  if (untilEnd < 0) return { kind: 'complete' };

  const remaining = untilEnd + 1;
  return {
    kind: 'label',
    label: remaining === 1 ? '1 Day Left' : `${remaining} Days Left`,
  };
}

export function validateTravelDateRange(
  startDate: string,
  endDate: string,
  itinerary: TravelItineraryItem[] = [],
): TravelDateRangeValidation {
  if (!isDateKey(startDate) || !isDateKey(endDate)) {
    return { error: 'Choose valid travel dates.', conflicts: [] };
  }
  if (endDate < startDate) {
    return { error: 'The return date needs to be on or after departure.', conflicts: [] };
  }

  // Moments may live in Pre-trip / Post trip outside the trip window.
  const conflicts = itinerary.filter(
    (item) =>
      item.kind !== 'moment' &&
      (item.date < startDate || item.date > endDate),
  );
  if (conflicts.length > 0) {
    const names = conflicts.map((item) => `“${item.title}”`).join(', ');
    return {
      error: `Change or remove these itinerary items before shortening the trip: ${names}.`,
      conflicts,
    };
  }

  return { conflicts: [] };
}
