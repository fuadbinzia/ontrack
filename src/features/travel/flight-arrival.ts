import { airportTimeZone } from '@/features/travel/airport-timezones';
import {
    DAY_MS,
    addDays,
    formatDateKeyMedium,
    formatDuration,
    formatMinutes,
    fromDateKey,
    minutesBetween,
    toDateKey,
} from '@/utils/date';
import { getDateTimeFormatter } from '@/utils/intl-cache';

export type FlightArrival = {
  /** Arrival calendar day in the arrival airport's local zone (or departure zone if naive). */
  date: string;
  startMinutes: number;
  /** Whole days from the departure date key to the arrival date key. */
  dayOffset: number;
  /** True when both airports resolved to IANA zones. */
  timeZoneAware: boolean;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

function getZonedParts(utcMs: number, timeZone: string): ZonedParts {
  const parts = getDateTimeFormatter('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));
  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
    second: readPart(parts, 'second'),
  };
}

/** Convert a wall-clock local time in `timeZone` to a UTC epoch ms. */
export function zonedLocalToUtcMs(
  dateKey: string,
  minutesFromMidnight: number,
  timeZone: string,
): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = wallAsUtc;
  // Two passes cover most DST spring/fall edges.
  for (let pass = 0; pass < 2; pass++) {
    const local = getZonedParts(utcMs, timeZone);
    const asUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    utcMs = wallAsUtc - (asUtc - utcMs);
  }
  return utcMs;
}

function utcMsToZonedArrival(utcMs: number, timeZone: string): {
  date: string;
  startMinutes: number;
} {
  const local = getZonedParts(utcMs, timeZone);
  return {
    date: toDateKey(new Date(local.year, local.month - 1, local.day, 12)),
    startMinutes: local.hour * 60 + local.minute,
  };
}

function dayOffsetBetween(fromKey: string, toKey: string): number {
  return Math.round((fromDateKey(toKey).getTime() - fromDateKey(fromKey).getTime()) / DAY_MS);
}

function naiveArrival(
  date: string,
  startMinutes: number,
  durationMinutes: number,
): FlightArrival {
  const total = startMinutes + durationMinutes;
  const dayOffset = Math.floor(total / (24 * 60));
  const arrivalMinutes = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const arrivalDate = addDays(date, dayOffset);
  return {
    date: arrivalDate,
    startMinutes: arrivalMinutes,
    dayOffset,
    timeZoneAware: false,
  };
}

/**
 * Landing time from departure local + block duration, converted into the
 * arrival airport's local zone when both airports are known.
 */
export function calculateFlightArrival(input: {
  date: string;
  startMinutes: number;
  durationMinutes: number;
  departureAirport?: string;
  arrivalAirport?: string;
}): FlightArrival {
  const departureZone = airportTimeZone(input.departureAirport);
  const arrivalZone = airportTimeZone(input.arrivalAirport);
  if (!departureZone || !arrivalZone) {
    return naiveArrival(input.date, input.startMinutes, input.durationMinutes);
  }

  const departureUtc = zonedLocalToUtcMs(
    input.date,
    input.startMinutes,
    departureZone,
  );
  const arrivalUtc = departureUtc + input.durationMinutes * 60_000;
  const arrival = utcMsToZonedArrival(arrivalUtc, arrivalZone);
  return {
    ...arrival,
    dayOffset: dayOffsetBetween(input.date, arrival.date),
    timeZoneAware: true,
  };
}

/** Block time between local departure and arrival clocks, using airport zones when known. */
export function calculateFlightDuration(input: {
  departureDate: string;
  departureMinutes: number;
  arrivalDate: string;
  arrivalMinutes: number;
  departureAirport?: string;
  arrivalAirport?: string;
}): number {
  const departureZone = airportTimeZone(input.departureAirport);
  const arrivalZone = airportTimeZone(input.arrivalAirport);
  if (!departureZone || !arrivalZone) {
    return minutesBetween(
      input.departureDate,
      input.departureMinutes,
      input.arrivalDate,
      input.arrivalMinutes,
    );
  }
  const departureUtc = zonedLocalToUtcMs(
    input.departureDate,
    input.departureMinutes,
    departureZone,
  );
  const arrivalUtc = zonedLocalToUtcMs(
    input.arrivalDate,
    input.arrivalMinutes,
    arrivalZone,
  );
  return Math.round((arrivalUtc - departureUtc) / 60_000);
}

export function formatFlightLandingLabel(arrival: FlightArrival): string {
  const time = formatMinutes(arrival.startMinutes);
  if (arrival.dayOffset === 0) return time;
  const sign = arrival.dayOffset > 0 ? '+' : '';
  return `${time} (${sign}${arrival.dayOffset})`;
}

export type FlightItineraryCaptionInput = {
  dateLabel: string;
  startMinutes: number;
  durationMinutes: number;
  departureAirport?: string;
  arrivalAirport?: string;
  connectionAirport?: string;
  layoverMinutesAfter?: number;
  connectionArrivalMinutes?: number;
  connectionDepartureMinutes?: number;
  /** When > 1, caption uses the connecting journey summary style. */
  legCount?: number;
  date: string;
};

/** Caption pieces for headers: date · duration · stops. */
export function flightItineraryCaptionParts(
  input: FlightItineraryCaptionInput,
): { dateLabel: string; durationLabel: string; stopsLabel: string } {
  const connection = input.connectionAirport?.trim().toUpperCase();
  const dep = input.departureAirport?.trim().toUpperCase();
  const arr = input.arrivalAirport?.trim().toUpperCase();
  const connecting =
    (input.legCount !== undefined && input.legCount > 1) ||
    (Boolean(connection) && connection !== dep && connection !== arr);
  const stops = connecting
    ? Math.max(
        1,
        (input.legCount ?? 2) - 1,
        connection && connection !== dep && connection !== arr ? 1 : 0,
      )
    : 0;
  return {
    dateLabel: input.dateLabel,
    durationLabel: `${formatDuration(input.durationMinutes)} total`,
    stopsLabel: stops === 0 ? 'Nonstop' : `${stops} stop${stops === 1 ? '' : 's'}`,
  };
}

/** Journey-card date chrome: `Sep 27`. */
export function formatFlightJourneyDate(date: string): string {
  return formatDateKeyMedium(date);
}

export function formatFlightItineraryCaption(
  input: FlightItineraryCaptionInput,
): string {
  const parts = flightItineraryCaptionParts(input);
  return [parts.dateLabel, parts.durationLabel, parts.stopsLabel].join(' · ');
}
