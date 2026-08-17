import {
  calculateFlightArrival,
  calculateFlightDuration,
} from '@/features/travel/flight-arrival';
import type { TravelFlightDetails, TravelItineraryItem } from '@/features/travel/types';
import { isDateKey } from '@/utils/date';

export interface FlightScheduleDraft {
  departureDate: string;
  departureMinutes: number | null;
  arrivalDate: string;
  arrivalMinutes: number | null;
}

export function flightScheduleDraft(item: TravelItineraryItem): FlightScheduleDraft {
  const arrival = calculateFlightArrival({
    date: item.date,
    startMinutes: item.startMinutes,
    durationMinutes: item.durationMinutes,
    departureAirport: item.flight?.departureAirport,
    arrivalAirport: item.flight?.arrivalAirport,
  });
  return {
    departureDate: item.date,
    departureMinutes: item.startMinutes,
    arrivalDate: arrival.date,
    arrivalMinutes: arrival.startMinutes,
  };
}

export function validateFlightSchedule(
  draft: FlightScheduleDraft,
  details?: TravelFlightDetails,
):
  | {
      ok: true;
      value: { date: string; startMinutes: number; durationMinutes: number };
    }
  | { ok: false; error: string } {
  if (!isDateKey(draft.departureDate)) {
    return { ok: false, error: 'Choose a departure date.' };
  }
  if (draft.departureMinutes === null) {
    return { ok: false, error: 'Choose a departure time.' };
  }
  if (!isDateKey(draft.arrivalDate)) {
    return { ok: false, error: 'Choose an arrival date.' };
  }
  if (draft.arrivalMinutes === null) {
    return { ok: false, error: 'Choose an arrival time.' };
  }
  const durationMinutes = calculateFlightDuration({
    departureDate: draft.departureDate,
    departureMinutes: draft.departureMinutes,
    arrivalDate: draft.arrivalDate,
    arrivalMinutes: draft.arrivalMinutes,
    departureAirport: details?.departureAirport,
    arrivalAirport: details?.arrivalAirport,
  });
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: 'Arrival needs to be after departure.' };
  }
  if (durationMinutes > 3 * 24 * 60) {
    return { ok: false, error: 'Flight duration looks too long. Check the arrival time.' };
  }
  return {
    ok: true,
    value: {
      date: draft.departureDate,
      startMinutes: draft.departureMinutes,
      durationMinutes,
    },
  };
}
