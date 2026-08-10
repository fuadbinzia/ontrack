import type { TravelItineraryItem } from './types';

/** Title-case the kind word in rental itinerary titles (“Hertz Rental”). */
export function capitalizeRentalTitle(title: string): string {
  return title
    .replace(/\bCar rental\b/g, 'Car Rental')
    .replace(/\b rental\b/g, ' Rental');
}

/**
 * Early Icelandair AB2ZQV imports flipped the return leg to EWR → KEF (and
 * sometimes used Sep 13). Confirmation: FI 623 KEF 5:00 PM → EWR 7:15 PM on Sep 14.
 */
export function repairLegacyIcelandairRoundTripImport(
  itinerary: TravelItineraryItem[],
): { itinerary: TravelItineraryItem[]; correctedEndDate?: string } {
  let correctedEndDate: string | undefined;
  const next = itinerary.map((item) => {
    if (
      item.kind !== 'flight' ||
      item.flight?.flightNumber !== 'FI 623' ||
      item.flight.departureAirport !== 'EWR' ||
      item.flight.arrivalAirport !== 'KEF' ||
      item.startMinutes !== 17 * 60 ||
      item.durationMinutes !== 6 * 60 + 15 ||
      (item.date !== '2026-09-13' && item.date !== '2026-09-14')
    ) {
      return item;
    }
    correctedEndDate = '2026-09-14';
    return {
      ...item,
      title: 'Flight KEF → EWR',
      date: '2026-09-14',
      flight: {
        ...item.flight,
        departureAirport: 'KEF',
        arrivalAirport: 'EWR',
      },
    };
  });
  return { itinerary: next, correctedEndDate };
}

/** Ground truth from Hertz confirmation L666EBA86A0 (Compact Elite · KEF). */
const HERTZ_L666_PICKUP_MINUTES = 6 * 60 + 30;
const HERTZ_L666_DROPOFF_MINUTES = 15 * 60;

/**
 * Early Hertz OCR imports stole flight times, dropped drop-off, or used
 * incorrect placeholder pickup/drop-off times. Align L666EBA86A0 to the
 * confirmation: Sep 09 6:30 AM → Sep 14 3:00 PM at KEF.
 */
export function repairLegacyHertzRentalImport(
  itinerary: TravelItineraryItem[],
): TravelItineraryItem[] {
  return itinerary.map((item) => {
    if (
      item.kind !== 'rental' ||
      item.rental?.confirmationCode !== 'L666EBA86A0'
    ) {
      return item;
    }
    const alreadyCorrect =
      item.date === '2026-09-09' &&
      item.startMinutes === HERTZ_L666_PICKUP_MINUTES &&
      item.rental.dropoffDate === '2026-09-14' &&
      item.rental.dropoffMinutes === HERTZ_L666_DROPOFF_MINUTES &&
      Boolean(item.rental.pickupLocation) &&
      Boolean(item.rental.dropoffLocation);
    if (alreadyCorrect) {
      const title = capitalizeRentalTitle(item.title);
      return title === item.title ? item : { ...item, title };
    }
    return {
      ...item,
      title: 'Hertz Rental · Keflavik International Airport (KEF)',
      date: '2026-09-09',
      startMinutes: HERTZ_L666_PICKUP_MINUTES,
      durationMinutes: 60,
      rental: {
        ...item.rental,
        company: 'Hertz',
        confirmationCode: 'L666EBA86A0',
        pickupLocation: 'Keflavik International Airport (KEF)',
        dropoffLocation: 'Keflavik International Airport (KEF)',
        vehicleClass: item.rental.vehicleClass ?? 'Compact Elite',
        dropoffDate: '2026-09-14',
        dropoffMinutes: HERTZ_L666_DROPOFF_MINUTES,
      },
    };
  });
}
