import { addDays } from '@/utils/date';
import { airlineName, CONFIRMATION_AIRLINE_CODES } from './airline-catalog';
import { findConfirmationMoney } from './confirmation-money';
import { findAircraft, findPassenger } from './flight-confirmation-fields';
import {
    findFlightConfirmationDate,
    likelyItineraryDates,
} from './flight-confirmation-parser-dates';
import { repairConnectingSegments } from './flight-connection-hub';
import {
    emptyFlightDetailsDraft,
    type FlightDetailsDraft,
} from './flight-details';
import { flightExpenseTitleFromSegments } from './flight-expense-title';
import {
  firstMatch,
  findArrivalTime,
  findDepartureTime,
  findDurationMinutes,
  findRoute,
  parseMinutes,
  validAirportCode,
} from './flight-confirmation-parser-times';
import {
    parseLabeledFlightGate,
    parseLabeledFlightTerminal,
    parseOrderedBareFlightGates,
    parseOrderedBareFlightTerminals,
} from './flight-terminal';

export interface ParsedFlightSegment {
  flight: FlightDetailsDraft;
  title?: string;
  date?: string;
  startMinutes?: number;
  arrivalDate?: string;
  arrivalMinutes?: number;
  durationMinutes?: number;
  layoverMinutesAfter?: number;
  /** Equipment line from the confirmation, e.g. "Boeing 737-800 Passenger". */
  aircraft?: string;
  detectedFieldCount: number;
}

export interface ParsedFlightConfirmation extends ParsedFlightSegment {
  segments: ParsedFlightSegment[];
  /** All likely travel dates recognized anywhere in the confirmation text. */
  itineraryDates?: string[];
  amount?: number;
  currency?: string;
}

const AIRLINE_CODES = CONFIRMATION_AIRLINE_CODES.join('|');

interface FlightNumberMatch {
  index: number;
  code: string;
  number: string;
}

interface TimedAirportEvent {
  index: number;
  minutes: number;
  airportCode: string;
}

interface OcrToken {
  index: number;
  lineIndex: number;
}

/** Chase/email footers that must not stay attached to the last Depart/Return block. */
const LABELED_LEG_FOOTER =
  /^\s*(?:traveler\s+\d|payment\s+summary|important\s+flight|rules,?\s+policies|real\s+id\s+requirements)\b/gim;

function findLabeledLegBlocks(text: string): string[] {
  const markers = Array.from(text.matchAll(/^\s*(?:depart|return)\s*:/gim));
  if (markers.length < 2) return [];
  const footers = Array.from(text.matchAll(LABELED_LEG_FOOTER));
  return markers.map((marker, index) => {
    const nextMarkerIndex = markers[index + 1]?.index ?? text.length;
    const footer = footers.find(
      (entry) =>
        entry.index !== undefined &&
        marker.index !== undefined &&
        entry.index > marker.index &&
        entry.index < nextMarkerIndex,
    );
    return text.slice(marker.index, footer?.index ?? nextMarkerIndex);
  });
}

function findFlightNumbers(text: string): FlightNumberMatch[] {
  const matches: FlightNumberMatch[] = [];
  const patterns = [
    /flight(?:\s+(?:number|no\.?|#))?\s*[:#-]?\s*([A-Z0-9]{2,3})\s*[- ]?\s*(\d{1,4}[A-Z]?)\b/gi,
    new RegExp(`\\b(${AIRLINE_CODES})\\s*[- ]?\\s*(\\d{1,4}[A-Z]?)\\b`, 'gi'),
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      matches.push({
        index: match.index,
        code: match[1].toUpperCase(),
        number: match[2].toUpperCase(),
      });
    }
  }
  const earliestByFlight = new Map<string, FlightNumberMatch>();
  for (const match of matches.sort((left, right) => left.index - right.index)) {
    const key = `${match.code} ${match.number}`;
    if (!earliestByFlight.has(key)) earliestByFlight.set(key, match);
  }
  return Array.from(earliestByFlight.values()).sort(
    (left, right) => left.index - right.index,
  );
}

function findTimedAirportEvents(text: string): TimedAirportEvent[] {
  const lines = Array.from(text.matchAll(/^.*$/gm));
  const times: (OcrToken & { minutes: number })[] = [];
  const airports: (OcrToken & { airportCode: string })[] = [];

  lines.forEach((lineMatch, lineIndex) => {
    for (const match of lineMatch[0].matchAll(
      /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi,
    )) {
      times.push({
        index: lineMatch.index + match.index,
        lineIndex,
        minutes: parseMinutes(match[1], match[2], match[3]),
      });
    }
    for (const match of lineMatch[0].matchAll(/\(([A-Z]{3})\)/gi)) {
      const airportCode = match[1].toUpperCase();
      if (!validAirportCode(airportCode)) continue;
      airports.push({
        index: lineMatch.index + match.index,
        lineIndex,
        airportCode,
      });
    }
    // Chase return legs print bare codes under each time ("05:00 pm\nKEF").
    const bareLine = /^\s*([A-Z]{3})(?:\s+([A-Z]{3}))?\s*$/.exec(lineMatch[0]);
    if (bareLine) {
      for (const code of [bareLine[1], bareLine[2]]) {
        const airportCode = code?.toUpperCase();
        if (!airportCode || !validAirportCode(airportCode)) continue;
        airports.push({
          index: lineMatch.index + (lineMatch[0].indexOf(code!) ?? 0),
          lineIndex,
          airportCode,
        });
      }
    }
  });

  const usedAirports = new Set<number>();
  return times.flatMap((time) => {
    const airport = airports
      .map((candidate, airportIndex) => ({
        ...candidate,
        airportIndex,
        lineDistance: candidate.lineIndex - time.lineIndex,
      }))
      .filter(
        (candidate) =>
          !usedAirports.has(candidate.airportIndex) &&
          Math.abs(candidate.lineDistance) <= 2,
      )
      .sort((left, right) => {
        const leftScore =
          Math.abs(left.lineDistance) + (left.lineDistance < 0 ? 10 : 0);
        const rightScore =
          Math.abs(right.lineDistance) + (right.lineDistance < 0 ? 10 : 0);
        return leftScore - rightScore || left.index - right.index;
      })[0];
    if (!airport) return [];
    usedAirports.add(airport.airportIndex);
    return [
      {
        index: time.index,
        minutes: time.minutes,
        airportCode: airport.airportCode,
      },
    ];
  });
}

function findLayoverMinutes(text: string): number[] {
  return Array.from(
    text.matchAll(
      /\b(?:(\d{1,2})\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d{1,2})\s*(?:m|min|mins|minute|minutes))?\s+layover\b/gi,
    ),
  )
    .map((match) => Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0))
    .filter((minutes) => minutes > 0);
}

function segmentGapDays(left?: string, right?: string): number | undefined {
  if (!left || !right) return undefined;
  const gapMs =
    new Date(`${right}T12:00:00`).getTime() -
    new Date(`${left}T12:00:00`).getTime();
  return Math.round(gapMs / (24 * 60 * 60 * 1000));
}

function hasConnectingTimedItinerary(
  events: TimedAirportEvent[],
  layovers: number[],
  legCount: number,
  segments: ParsedFlightSegment[],
): boolean {
  if (legCount < 2 || events.length < legCount * 2) return false;
  if (layovers.length > 0) return true;
  for (let index = 0; index < legCount - 1; index += 1) {
    const arrival = events[index * 2 + 1];
    const nextDeparture = events[index * 2 + 2];
    if (
      !arrival ||
      !nextDeparture ||
      arrival.airportCode !== nextDeparture.airportCode
    ) {
      continue;
    }
    // Same airport can be a connection or a round-trip turnaround days later.
    const gapDays = segmentGapDays(
      segments[index]?.date,
      segments[index + 1]?.date,
    );
    if (gapDays !== undefined && gapDays > 1) continue;
    return true;
  }
  return false;
}

/**
 * When OCR finds timed airports for a layover itinerary but misses a flight
 * number, pad segments so each leg still gets the correct airports/times.
 */
function padSegmentsForTimedLegs(
  segments: ParsedFlightSegment[],
  text: string,
  tripRange: { startDate: string; endDate: string } | undefined,
  legCount: number,
): ParsedFlightSegment[] {
  if (segments.length >= legCount) return segments.slice(0, legCount);
  const flightNumbers = findFlightNumbers(text);
  const confirmationCode = segments[0]?.flight.confirmationCode ?? '';
  const airline = segments[0]?.flight.airline ?? '';
  return Array.from({ length: legCount }, (_, index) => {
    const existing = segments[index];
    if (existing) return existing;
    const flightNumber = flightNumbers[index];
    if (flightNumber) {
      const next = flightNumbers[index + 1];
      return parseSegment(
        text.slice(flightNumber.index, next?.index ?? text.length),
        tripRange,
        confirmationCode,
        flightNumber,
      );
    }
    return {
      flight: {
        ...emptyFlightDetailsDraft(),
        confirmationCode,
        airline,
      },
      detectedFieldCount: 0,
    };
  });
}

function applyTimedAirportItinerary(
  segments: ParsedFlightSegment[],
  text: string,
  tripRange?: { startDate: string; endDate: string },
): ParsedFlightSegment[] {
  const events = findTimedAirportEvents(text);
  const layovers = findLayoverMinutes(text);
  const eventLegs = Math.floor(events.length / 2);
  const connecting = hasConnectingTimedItinerary(
    events,
    layovers,
    eventLegs,
    segments,
  );
  // Round-trips (JetBlue trip detail, etc.) already have per-leg airports from
  // parseSegment. A global Boards/Doors/Departs/Arrives scan must not rewrite them.
  if (!connecting) return segments;
  // Only grow beyond recognized flight numbers when layover/connection evidence exists.
  const targetLegs = Math.max(segments.length, eventLegs);
  if (targetLegs < 2 || events.length < targetLegs * 2) return segments;

  const padded = connecting
    ? padSegmentsForTimedLegs(segments, text, tripRange, targetLegs)
    : segments.slice(0, targetLegs);
  const itineraryEvents = events.slice(0, padded.length * 2);
  const firstDate =
    padded[0]?.date ??
    findFlightConfirmationDate(text, tripRange?.startDate, tripRange?.endDate);
  let departureDate = firstDate;

  return padded.map((segment, index) => {
    const departure = itineraryEvents[index * 2];
    const arrival = itineraryEvents[index * 2 + 1];
    const nextDeparture = itineraryEvents[index * 2 + 2];
    const nextSegment = padded[index + 1];
    const gapDays = segmentGapDays(segment.date ?? departureDate, nextSegment?.date);
    const directLayover = layovers[index];
    const computedLayover =
      connecting &&
      nextDeparture &&
      arrival.airportCode === nextDeparture.airportCode &&
      (gapDays === undefined || gapDays <= 1)
        ? (nextDeparture.minutes - arrival.minutes + 24 * 60) % (24 * 60)
        : undefined;
    const layoverMinutesAfter = directLayover ?? computedLayover;
    const timedDuration =
      departure && arrival
        ? (arrival.minutes - departure.minutes + 24 * 60) % (24 * 60)
        : undefined;
    // Round-trips keep each leg's calendar date. Only connections cascade
    // overnight from the prior arrival into the next departure day.
    const legDate = connecting
      ? (departureDate ?? segment.date)
      : (segment.date ?? departureDate);
    const next = {
      ...segment,
      date: legDate,
      startMinutes: departure.minutes,
      title: `Flight ${departure.airportCode} → ${arrival.airportCode}`,
      durationMinutes:
        segment.durationMinutes && segment.durationMinutes > 0
          ? segment.durationMinutes
          : timedDuration && timedDuration > 0
            ? timedDuration
            : segment.durationMinutes,
      flight: {
        ...segment.flight,
        departureAirport: departure.airportCode,
        arrivalAirport: arrival.airportCode,
      },
      ...(layoverMinutesAfter ? { layoverMinutesAfter } : {}),
    };
    if (
      connecting &&
      departureDate &&
      nextDeparture &&
      nextDeparture.minutes < arrival.minutes
    ) {
      departureDate = addDays(departureDate, 1);
    }
    return next;
  });
}

function parseSegment(
  text: string,
  tripRange: { startDate: string; endDate: string } | undefined,
  confirmationCode: string,
  flightNumber?: FlightNumberMatch,
): ParsedFlightSegment {
  const flight = emptyFlightDetailsDraft();
  flight.confirmationCode = confirmationCode;
  if (flightNumber) {
    flight.flightNumber = `${flightNumber.code} ${flightNumber.number}`;
    flight.airline = airlineName(flightNumber.code) ?? '';
  }
  const route = findRoute(text);
  const bareTerminals = parseOrderedBareFlightTerminals(text);
  const bareGates = parseOrderedBareFlightGates(text);
  flight.departureAirport = route.departureAirport;
  flight.departureTerminal =
    parseLabeledFlightTerminal(text, 'departure') || bareTerminals.departure;
  flight.departureGate =
    parseLabeledFlightGate(text, 'departure') || bareGates.departure;
  flight.arrivalAirport = route.arrivalAirport;
  flight.arrivalTerminal =
    parseLabeledFlightTerminal(text, 'arrival') || bareTerminals.arrival;
  flight.arrivalGate =
    parseLabeledFlightGate(text, 'arrival') || bareGates.arrival;
  flight.seat =
    firstMatch(text, [
      /(?:seat|seat\s+assignment)\s*(?:[:#-]\s*|\n\s*)([A-Z]?\d{1,3}[A-Z]?)\b/i,
    ])?.toUpperCase() ?? '';

  if (!flight.airline) {
    flight.airline =
      firstMatch(text, [
        /\b((?:[A-Z][A-Za-z&.'’-]+\s+){0,3}(?:Airlines|Airways|Air Lines))\b/,
        /\b(Icelandair|Lufthansa|Emirates|JetBlue|Southwest|Qantas|KLM)\b/i,
      ]) ?? '';
  }

  const date = findFlightConfirmationDate(
    text,
    tripRange?.startDate,
    tripRange?.endDate,
  );
  const startMinutes = findDepartureTime(text);
  const arrivalMinutes = findArrivalTime(text);
  let durationMinutes = findDurationMinutes(text);
  if (
    durationMinutes === undefined &&
    startMinutes !== undefined &&
    arrivalMinutes !== undefined
  ) {
    const span = (arrivalMinutes - startMinutes + 24 * 60) % (24 * 60);
    if (span > 0) durationMinutes = span;
  }
  const aircraft = findAircraft(text);
  const routeTitle = [flight.departureAirport, flight.arrivalAirport]
    .filter(Boolean)
    .join(' → ');
  const title = routeTitle
    ? `Flight ${routeTitle}`
    : flight.flightNumber
      ? `Flight ${flight.flightNumber}`
      : undefined;
  const detectedFieldCount =
    Object.values(flight).filter(Boolean).length +
    (date ? 1 : 0) +
    (startMinutes !== undefined ? 1 : 0) +
    (durationMinutes !== undefined ? 1 : 0);
  let arrivalDate: string | undefined;
  if (date && arrivalMinutes !== undefined) {
    arrivalDate =
      startMinutes !== undefined && arrivalMinutes < startMinutes
        ? addDays(date, 1)
        : date;
  }
  return {
    flight,
    title,
    date,
    startMinutes,
    ...(arrivalDate ? { arrivalDate } : {}),
    ...(arrivalMinutes !== undefined ? { arrivalMinutes } : {}),
    durationMinutes,
    ...(aircraft ? { aircraft } : {}),
    detectedFieldCount,
  };
}

export function parseFlightConfirmation(
  sourceText: string,
  tripRange?: { startDate: string; endDate: string },
): ParsedFlightConfirmation {
  const text = sourceText.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ');
  const confirmationCode =
    firstMatch(text, [
      /(?:airline\s+)?confirmation(?:\s+(?:code|number|#))?\s*[:#-]?\s*([A-Z0-9-]{3,12})\b/i,
      /booking\s+(?:reference|code|number)\s*[:#-]?\s*([A-Z0-9-]{3,12})\b/i,
      /(?:record\s+locator|reservation\s+(?:code|number))\s*[:#-]?\s*([A-Z0-9-]{3,12})\b/i,
    ])?.toUpperCase() ?? '';
  const flightNumbers = findFlightNumbers(text);
  const labeledSegments = findLabeledLegBlocks(text).flatMap((block) => {
    const blockFlight = findFlightNumbers(block)[0];
    return blockFlight
      ? [parseSegment(block, tripRange, confirmationCode, blockFlight)]
      : [];
  });
  const parsedSegments =
    labeledSegments.length >= 2
      ? labeledSegments
      : flightNumbers.length > 0
        ? flightNumbers.map((flightNumber, index) => {
            const next = flightNumbers[index + 1];
            const start = index === 0 ? 0 : flightNumber.index;
            const end = next?.index ?? text.length;
            return parseSegment(
              text.slice(start, end),
              tripRange,
              confirmationCode,
              flightNumber,
            );
          })
        : [parseSegment(text, tripRange, confirmationCode)];
  const passenger = findPassenger(text);
  const segments = repairConnectingSegments(
    applyTimedAirportItinerary(parsedSegments, text, tripRange).map(
      (segment) => ({
        ...segment,
        flight: { ...segment.flight, ...passenger },
      }),
    ),
    text,
  );
  const itineraryDates = likelyItineraryDates(text);
  const first = segments[0];
  const money = findConfirmationMoney(text);
  const routeTitle = flightExpenseTitleFromSegments(segments);
  return {
    ...first,
    ...(routeTitle ? { title: routeTitle } : {}),
    segments,
    ...(itineraryDates.length ? { itineraryDates } : {}),
    amount: money.amount,
    currency: money.currency,
    detectedFieldCount:
      segments.reduce(
        (count, segment) => count + segment.detectedFieldCount,
        0,
      ) + (money.amount !== undefined ? 1 : 0),
  };
}
