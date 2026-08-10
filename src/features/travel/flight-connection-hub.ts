import { airportCodeForCityName } from './airport-catalog';
import { normalizeAirportCode } from './airport-timezones';
import type { ParsedFlightSegment } from './flight-confirmation-parser';
import { emptyFlightDetailsDraft } from './flight-details';

/** "1h 39m layover in Houston" → Houston */
const LAYOVER_CITY =
  /\blayover\s+in\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?:\s*[,.]|\s*$|\s*\()/gim;

/** Header route: "Guatemala City (GUA) → New York (LGA)" (OCR may break city names). */
const SUMMARY_PAREN_ROUTE =
  /\(([A-Z]{3})\)\s*(?:→|->|–|—|-|\bTO\b)\s*[\s\S]{0,80}?\(([A-Z]{3})\)/i;

const SUMMARY_BARE_ROUTE = /\b([A-Z]{3})\s*(?:→|->|–|—)\s*([A-Z]{3})\b/;

const NON_AIRPORT_CODES = new Set([
  'AND',
  'ARE',
  'DUE',
  'FOR',
  'FROM',
  'HAS',
  'NOT',
  'THE',
  'THIS',
  'TO',
  'TRIP',
  'WAS',
  'WITH',
  'YOU',
  'YOUR',
]);

function validAirportCode(value: string | undefined): value is string {
  return Boolean(
    value && /^[A-Z]{3}$/.test(value) && !NON_AIRPORT_CODES.has(value),
  );
}

export function findLayoverCityAirportCode(text: string): string | undefined {
  for (const match of text.matchAll(LAYOVER_CITY)) {
    const code = airportCodeForCityName(match[1] ?? '');
    if (code) return code;
  }
  return undefined;
}

export function findLayoverMinutesInText(text: string): number | undefined {
  const match =
    /\b(?:(\d{1,2})\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d{1,2})\s*(?:m|min|mins|minute|minutes))?\s+layover\b/i.exec(
      text,
    );
  if (!match) return undefined;
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes > 0 ? minutes : undefined;
}

/**
 * Overall itinerary endpoints from confirmation chrome (not a single leg).
 * Allows newlines inside city names so Android OCR "New\\nYork (LGA)" still works.
 */
export function findItinerarySummaryRoute(
  text: string,
): { departureAirport: string; arrivalAirport: string } | undefined {
  const paren = SUMMARY_PAREN_ROUTE.exec(text);
  const departure = paren?.[1]?.toUpperCase();
  const arrival = paren?.[2]?.toUpperCase();
  if (validAirportCode(departure) && validAirportCode(arrival) && departure !== arrival) {
    return { departureAirport: departure, arrivalAirport: arrival };
  }

  const bare = SUMMARY_BARE_ROUTE.exec(text);
  const bareDep = bare?.[1]?.toUpperCase();
  const bareArr = bare?.[2]?.toUpperCase();
  if (validAirportCode(bareDep) && validAirportCode(bareArr) && bareDep !== bareArr) {
    return { departureAirport: bareDep, arrivalAirport: bareArr };
  }
  return undefined;
}

/**
 * Hub where a connecting itinerary changes planes.
 * Prefer the shared airport between leg 1 arrival and leg 2 departure.
 * When OCR disagrees (e.g. first arrival wrongly equals the final destination),
 * prefer the second leg's departure, then a "layover in {city}" clue.
 */
export function resolveConnectingHub(
  segments: ParsedFlightSegment[],
  sourceText = '',
): string | undefined {
  if (segments.length < 2) return undefined;
  const firstArrival = normalizeAirportCode(segments[0]?.flight.arrivalAirport);
  const secondDeparture = normalizeAirportCode(
    segments[1]?.flight.departureAirport,
  );
  const origin = normalizeAirportCode(segments[0]?.flight.departureAirport);
  const lastArrival = normalizeAirportCode(
    segments.at(-1)?.flight.arrivalAirport,
  );
  const lastDeparture = normalizeAirportCode(
    segments.at(-1)?.flight.departureAirport,
  );
  const layoverCity = findLayoverCityAirportCode(sourceText);
  const summary = findItinerarySummaryRoute(sourceText);
  const summaryDest = summary?.arrivalAirport;
  const collapsedFinal = Boolean(lastArrival && lastArrival === lastDeparture);
  // Trust a last-leg arrival only when it is not a collapsed "IAH → IAH" OCR pair.
  const finalArrival = collapsedFinal ? undefined : lastArrival;

  const usable = (code?: string) => {
    if (!code || code === origin || code === summaryDest) return false;
    if (code === finalArrival) return false;
    // GUA→LGA + LGA→LGA with no layover city is destination noise, not a hub.
    if (
      collapsedFinal &&
      !layoverCity &&
      code === lastArrival &&
      firstArrival === lastArrival
    ) {
      return false;
    }
    return true;
  };

  if (firstArrival && secondDeparture && firstArrival === secondDeparture) {
    const onward =
      Boolean(lastArrival && lastArrival !== firstArrival) ||
      Boolean(summaryDest && summaryDest !== firstArrival) ||
      layoverCity === firstArrival;
    if (usable(firstArrival) && onward) return firstArrival;
    // Shared airport with no onward destination/layover — destination noise.
    if (!onward) return undefined;
  }

  // OCR often keeps the summary destination on leg 1 arrival while leg 2 still
  // departs the real hub — prefer the continue-from airport.
  if (usable(secondDeparture)) return secondDeparture;
  if (usable(layoverCity)) return layoverCity;
  if (usable(firstArrival)) return firstArrival;

  return undefined;
}

function withLayoverMinutes(
  segment: ParsedFlightSegment,
  sourceText: string,
): ParsedFlightSegment {
  if (segment.layoverMinutesAfter !== undefined) return segment;
  const minutes = findLayoverMinutesInText(sourceText);
  return minutes !== undefined
    ? { ...segment, layoverMinutesAfter: minutes }
    : segment;
}

/**
 * Android/ML Kit often reads the first leg + layover + second departure, but
 * drops the final "New York (LGA)" line. When the header still says GUA → LGA
 * and a layover hub is known, expand/repair into a full connecting journey.
 */
function expandConnectingFromSummary(
  segments: ParsedFlightSegment[],
  sourceText: string,
): ParsedFlightSegment[] {
  const summary = findItinerarySummaryRoute(sourceText);
  const layoverHub = findLayoverCityAirportCode(sourceText);
  if (!summary || !layoverHub) return segments;
  if (
    layoverHub === summary.departureAirport ||
    layoverHub === summary.arrivalAirport
  ) {
    return segments;
  }

  if (segments.length === 0) return segments;

  if (segments.length === 1) {
    const first = segments[0]!;
    const origin =
      normalizeAirportCode(first.flight.departureAirport) ||
      summary.departureAirport;
    const arrival =
      normalizeAirportCode(first.flight.arrivalAirport) ||
      summary.arrivalAirport;
    // Only expand when this looks like a layover itinerary, not a simple
    // nonstop that happens to mention a city elsewhere.
    const looksConnecting =
      first.layoverMinutesAfter !== undefined ||
      Boolean(findLayoverMinutesInText(sourceText)) ||
      arrival === layoverHub ||
      arrival === summary.arrivalAirport;
    if (!looksConnecting || !origin) return segments;

    const nextFirst: ParsedFlightSegment = withLayoverMinutes(
      {
        ...first,
        title: `Flight ${origin} → ${layoverHub}`,
        flight: {
          ...first.flight,
          departureAirport: origin,
          arrivalAirport: layoverHub,
          connectionAirport: layoverHub,
        },
      },
      sourceText,
    );
    const nextSecond: ParsedFlightSegment = {
      flight: {
        ...emptyFlightDetailsDraft(),
        airline: first.flight.airline,
        confirmationCode: first.flight.confirmationCode,
        departureAirport: layoverHub,
        arrivalAirport: summary.arrivalAirport,
      },
      title: `Flight ${layoverHub} → ${summary.arrivalAirport}`,
      detectedFieldCount: 2,
    };
    return [nextFirst, nextSecond];
  }

  return segments;
}

/**
 * Repair connecting segments after OCR so layover + connection airport agree.
 * Clears layover minutes when no hub distinct from origin/destination exists.
 * Fills a missing final destination from the itinerary summary route.
 */
function clearCollapsedLegArrival(
  segment: ParsedFlightSegment,
): ParsedFlightSegment {
  const dep = normalizeAirportCode(segment.flight.departureAirport);
  const arr = normalizeAirportCode(segment.flight.arrivalAirport);
  if (!dep || !arr || dep !== arr) return segment;
  return {
    ...segment,
    flight: { ...segment.flight, arrivalAirport: '' },
  };
}

function segmentDateGapDays(left?: string, right?: string): number | undefined {
  if (!left || !right) return undefined;
  const gapMs =
    new Date(`${right}T12:00:00`).getTime() -
    new Date(`${left}T12:00:00`).getTime();
  return Math.round(gapMs / (24 * 60 * 60 * 1000));
}

export function repairConnectingSegments(
  segments: ParsedFlightSegment[],
  sourceText = '',
): ParsedFlightSegment[] {
  const expanded = expandConnectingFromSummary(segments, sourceText);
  if (expanded.length < 2) return expanded;

  // Multi-day turnarounds (JetBlue round-trips) share a destination/origin
  // airport but are not connections — leave per-leg airports alone.
  const roundTripGap = segmentDateGapDays(
    expanded[0]?.date,
    expanded[1]?.date,
  );
  if (roundTripGap !== undefined && roundTripGap > 1) {
    return expanded.map(clearCollapsedLegArrival);
  }

  // Resolve the hub before clearing collapsed "IAH → IAH" pairs so destination
  // noise like "LGA → LGA" still fails closed without a layover city.
  const hub = resolveConnectingHub(expanded, sourceText);
  const summary = findItinerarySummaryRoute(sourceText);
  const sanitized = [
    expanded[0]!,
    clearCollapsedLegArrival(expanded[1]!),
    ...expanded.slice(2).map(clearCollapsedLegArrival),
  ];
  const first = sanitized[0]!;
  const second = sanitized[1]!;

  if (!hub) {
    if (!first.layoverMinutesAfter) return sanitized;
    const { layoverMinutesAfter: _drop, ...rest } = first;
    return [{ ...rest }, ...sanitized.slice(1)];
  }

  const rawLastArrival = normalizeAirportCode(
    sanitized.at(-1)?.flight.arrivalAirport,
  );
  const finalArrival =
    (rawLastArrival && rawLastArrival !== hub ? rawLastArrival : undefined) ||
    (summary?.arrivalAirport && summary.arrivalAirport !== hub
      ? summary.arrivalAirport
      : undefined);
  const origin =
    normalizeAirportCode(first.flight.departureAirport) ||
    summary?.departureAirport;

  const nextFirst: ParsedFlightSegment = withLayoverMinutes(
    {
      ...first,
      title: origin && hub ? `Flight ${origin} → ${hub}` : first.title,
      flight: {
        ...first.flight,
        ...(origin ? { departureAirport: origin } : {}),
        arrivalAirport: hub,
        connectionAirport: hub,
      },
    },
    sourceText,
  );

  const secondArrival =
    normalizeAirportCode(second.flight.arrivalAirport) ||
    (finalArrival && finalArrival !== hub ? finalArrival : undefined);

  const nextSecond: ParsedFlightSegment = {
    ...second,
    title:
      hub && secondArrival
        ? `Flight ${hub} → ${secondArrival}`
        : second.title,
    flight: {
      ...second.flight,
      departureAirport: hub,
      ...(secondArrival ? { arrivalAirport: secondArrival } : {}),
    },
  };

  // Later legs (3+) keep as-is; only patch a missing last-leg arrival from summary.
  const rest = sanitized.slice(2).map((segment, index, all) => {
    const isLast = index === all.length - 1;
    if (!isLast || segment.flight.arrivalAirport || !summary?.arrivalAirport) {
      return segment;
    }
    if (summary.arrivalAirport === hub) return segment;
    return {
      ...segment,
      title: segment.flight.departureAirport
        ? `Flight ${segment.flight.departureAirport} → ${summary.arrivalAirport}`
        : segment.title,
      flight: {
        ...segment.flight,
        arrivalAirport: summary.arrivalAirport,
      },
    };
  });

  return [nextFirst, nextSecond, ...rest];
}
