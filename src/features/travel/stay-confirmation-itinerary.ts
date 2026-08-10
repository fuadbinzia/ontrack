import type { ParsedStayConfirmation } from '@/features/travel/stay-confirmation-parser';
import type { TravelPlan } from '@/features/travel/types';

/**
 * Fill blank trip dates from stay check-in / check-out, and widen an existing
 * range when the confirmation falls outside it (same contract as flights/rentals).
 * Empty trip dates are treated as missing so Airbnb trip-page uploads can seed
 * the plan range.
 */
export function expandedTripRangeForStay(
  tripRange: Pick<TravelPlan, 'startDate' | 'endDate'>,
  parsed: Pick<ParsedStayConfirmation, 'date'> & {
    stay: { checkoutDate?: string };
  },
): Pick<TravelPlan, 'startDate' | 'endDate'> {
  const dates = [parsed.date, parsed.stay.checkoutDate].filter(
    (date): date is string => Boolean(date?.trim()),
  );
  if (dates.length === 0) return tripRange;

  return {
    startDate: dates.reduce(
      (earliest, date) =>
        !earliest.trim() || date < earliest ? date : earliest,
      tripRange.startDate ?? '',
    ),
    endDate: dates.reduce(
      (latest, date) => (!latest.trim() || date > latest ? date : latest),
      tripRange.endDate ?? '',
    ),
  };
}
