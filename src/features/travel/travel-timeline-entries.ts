import { normalizeAirportCode } from '@/features/travel/airport-timezones';
import {
  calculateFlightArrival,
  formatFlightItineraryCaption,
  type FlightItineraryCaptionInput,
} from '@/features/travel/flight-arrival';
import { formatFlightRouteLabel } from '@/features/travel/flight-route-label';
import type { TravelItineraryItem, TravelRouteStop } from '@/features/travel/types';
import { transportModeLabel } from '@/features/travel/travel-mode';
import {
  formatDateKeyMedium,
  formatDuration,
  formatMinutes,
  type DateDisplayFormat,
} from '@/utils/date';

/** Prefer IATA in tight timeline captions; keep free-text when no code is present. */
function timelineLocationLabel(location?: string): string | undefined {
  if (!location?.trim()) return undefined;
  return normalizeAirportCode(location) ?? location.trim();
}

/** Action phase shown as a distinct timeline marker. */
export type TravelTimelinePhase =
  | 'board'
  | 'land'
  | 'pickup'
  | 'dropoff'
  | 'checkin'
  | 'checkout'
  | 'depart'
  | 'arrive'
  | 'stop'
  | 'default';

export type TravelTimelineEntry = {
  /** Stable key for list rendering / expand state (`itemId` or `itemId:phase`). */
  key: string;
  item: TravelItineraryItem;
  phase: TravelTimelinePhase;
  date: string;
  startMinutes: number;
  title: string;
  stop?: TravelRouteStop;
};

const PHASE_TITLE: Record<Exclude<TravelTimelinePhase, 'default'>, string> = {
  board: 'Board Flight',
  land: 'Land',
  pickup: 'Pick Up Car',
  dropoff: 'Drop Off Car',
  checkin: 'Check In',
  checkout: 'Check Out',
  depart: 'Depart',
  arrive: 'Arrive',
  stop: 'Route Stop',
};

function flightRoute(item: TravelItineraryItem): string | undefined {
  return formatFlightRouteLabel(item.flight);
}

/** Caption inputs for a flight, shared by string and header renderers. */
export function flightCaptionInput(
  item: TravelItineraryItem,
  _dateDisplayFormat?: DateDisplayFormat,
): FlightItineraryCaptionInput {
  const legCount = item.flight?.legs?.length;
  return {
    date: item.date,
    // Board chrome matches journey cards: `Sep 8` (not `9/8`).
    dateLabel: formatDateKeyMedium(item.date),
    startMinutes: item.startMinutes,
    durationMinutes: item.durationMinutes,
    departureAirport: item.flight?.departureAirport,
    arrivalAirport: item.flight?.arrivalAirport,
    connectionAirport: item.flight?.connectionAirport,
    layoverMinutesAfter: item.flight?.layoverMinutesAfter,
    connectionArrivalMinutes: item.flight?.connectionArrivalMinutes,
    connectionDepartureMinutes: item.flight?.connectionDepartureMinutes,
    ...(legCount ? { legCount } : {}),
  };
}

function expandItem(item: TravelItineraryItem): TravelTimelineEntry[] {
  if (item.kind === 'transport' && item.transport) {
    const details = item.transport;
    return [
      {
        key: `${item.id}:depart`,
        item,
        phase: 'depart',
        date: item.date,
        startMinutes: item.startMinutes,
        title: `Depart · ${details.origin}`,
      },
      ...(details.stops ?? []).flatMap((stop) =>
        stop.arrivalDate && stop.arrivalMinutes !== undefined
          ? [{
              key: `${item.id}:stop:${stop.id}`,
              item,
              phase: 'stop' as const,
              date: stop.arrivalDate,
              startMinutes: stop.arrivalMinutes,
              title: stop.name,
              stop,
            }]
          : [],
      ),
      {
        key: `${item.id}:arrive`,
        item,
        phase: 'arrive',
        date: details.arrivalDate,
        startMinutes: details.arrivalMinutes,
        title: `Arrive · ${details.destination}`,
      },
    ];
  }
  if (item.kind === 'flight') {
    const arrival = calculateFlightArrival({
      date: item.date,
      startMinutes: item.startMinutes,
      durationMinutes: item.durationMinutes,
      departureAirport: item.flight?.departureAirport,
      arrivalAirport: item.flight?.arrivalAirport,
    });
    const board: TravelTimelineEntry = {
      key: `${item.id}:board`,
      item,
      phase: 'board',
      date: item.date,
      startMinutes: item.startMinutes,
      title: PHASE_TITLE.board,
    };
    const land: TravelTimelineEntry = {
      key: `${item.id}:land`,
      item,
      phase: 'land',
      date: arrival.date,
      startMinutes: arrival.startMinutes,
      title: PHASE_TITLE.land,
    };
    return [board, land];
  }

  if (item.kind === 'rental') {
    const pickup: TravelTimelineEntry = {
      key: `${item.id}:pickup`,
      item,
      phase: 'pickup',
      date: item.date,
      startMinutes: item.startMinutes,
      title: PHASE_TITLE.pickup,
    };
    const dropoffDate = item.rental?.dropoffDate;
    const dropoffMinutes = item.rental?.dropoffMinutes;
    if (!dropoffDate && dropoffMinutes === undefined) {
      return [pickup];
    }
    const dropoff: TravelTimelineEntry = {
      key: `${item.id}:dropoff`,
      item,
      phase: 'dropoff',
      date: dropoffDate ?? item.date,
      startMinutes: dropoffMinutes ?? item.startMinutes,
      title: PHASE_TITLE.dropoff,
    };
    return [pickup, dropoff];
  }

  if (item.kind === 'stay') {
    const checkin: TravelTimelineEntry = {
      key: `${item.id}:checkin`,
      item,
      phase: 'checkin',
      date: item.date,
      startMinutes: item.startMinutes,
      title: PHASE_TITLE.checkin,
    };
    const checkoutDate = item.stay?.checkoutDate;
    const checkoutMinutes = item.stay?.checkoutMinutes;
    if (!checkoutDate && checkoutMinutes === undefined) {
      return [checkin];
    }
    const checkout: TravelTimelineEntry = {
      key: `${item.id}:checkout`,
      item,
      phase: 'checkout',
      date: checkoutDate ?? item.date,
      startMinutes: checkoutMinutes ?? item.startMinutes,
      title: PHASE_TITLE.checkout,
    };
    return [checkin, checkout];
  }

  return [
    {
      key: item.id,
      item,
      phase: 'default',
      date: item.date,
      startMinutes: item.startMinutes,
      title: item.title,
    },
  ];
}

/** Expand flights/rentals into board/land and pick-up/drop-off markers, sorted. */
export function expandTimelineEntries(
  items: TravelItineraryItem[],
): TravelTimelineEntry[] {
  return items
    .flatMap(expandItem)
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      if (byDate !== 0) return byDate;
      return left.startMinutes - right.startMinutes;
    });
}

export function groupTimelineEntriesByDate(
  entries: TravelTimelineEntry[],
): { date: string; entries: TravelTimelineEntry[] }[] {
  const map = new Map<string, TravelTimelineEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, list);
  }
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayEntries]) => ({
      date,
      entries: [...dayEntries].sort(
        (a, b) => a.startMinutes - b.startMinutes,
      ),
    }));
}

/** Collapse / agent key for moments before the trip window. */
export const TIMELINE_PRE_TRIP_KEY = '__timeline_pre_trip__';
/** Collapse / agent key for moments after the trip window. */
export const TIMELINE_POST_TRIP_KEY = '__timeline_post_trip__';

export type TimelineDayZone = 'pre' | 'trip' | 'post';

export type TimelineDaySection = {
  /** Collapse / list key — calendar date or synthetic Pre-trip / Post trip. */
  date: string;
  zone: TimelineDayZone;
  /** Inclusive calendar span of entries (for header meta). */
  rangeStart: string;
  rangeEnd: string;
  entries: TravelTimelineEntry[];
};

function sortTimelineEntries(
  entries: TravelTimelineEntry[],
): TravelTimelineEntry[] {
  return [...entries].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    if (byDate !== 0) return byDate;
    return left.startMinutes - right.startMinutes;
  });
}

/** Section collapse key for an itinerary date relative to the trip window. */
export function timelineSectionKeyForDate(
  date: string,
  planStartDate: string,
  planEndDate: string,
): string {
  if (date < planStartDate) return TIMELINE_PRE_TRIP_KEY;
  if (date > planEndDate) return TIMELINE_POST_TRIP_KEY;
  return date;
}

/**
 * Groups expanded markers into trip days, plus one Pre-trip and one Post trip
 * bucket for anything outside `planStartDate`…`planEndDate`.
 */
export function groupTimelineDaysForPlan(
  entries: TravelTimelineEntry[],
  planStartDate: string,
  planEndDate: string,
): TimelineDaySection[] {
  const byDate = groupTimelineEntriesByDate(entries);
  const preEntries: TravelTimelineEntry[] = [];
  const postEntries: TravelTimelineEntry[] = [];
  const sections: TimelineDaySection[] = [];

  for (const day of byDate) {
    if (day.date < planStartDate) {
      preEntries.push(...day.entries);
    } else if (day.date > planEndDate) {
      postEntries.push(...day.entries);
    } else {
      sections.push({
        date: day.date,
        zone: 'trip',
        rangeStart: day.date,
        rangeEnd: day.date,
        entries: day.entries,
      });
    }
  }

  if (preEntries.length) {
    const sorted = sortTimelineEntries(preEntries);
    sections.unshift({
      date: TIMELINE_PRE_TRIP_KEY,
      zone: 'pre',
      rangeStart: sorted[0]!.date,
      rangeEnd: sorted[sorted.length - 1]!.date,
      entries: sorted,
    });
  }

  if (postEntries.length) {
    const sorted = sortTimelineEntries(postEntries);
    sections.push({
      date: TIMELINE_POST_TRIP_KEY,
      zone: 'post',
      rangeStart: sorted[0]!.date,
      rangeEnd: sorted[sorted.length - 1]!.date,
      entries: sorted,
    });
  }

  return sections;
}

export function timelineEntryCaption(
  entry: TravelTimelineEntry,
  dateDisplayFormat: DateDisplayFormat,
): string {
  const { item, phase } = entry;
  const dateLabel = formatDateKeyMedium(entry.date);
  const time = formatMinutes(entry.startMinutes);

  if (phase === 'board') {
    const route = flightRoute(item);
    const duration = formatDuration(item.durationMinutes);
    return [dateLabel, time, route, duration].filter(Boolean).join(' · ');
  }

  if (phase === 'land') {
    const airport = item.flight?.arrivalAirport;
    return [dateLabel, time, airport].filter(Boolean).join(' · ');
  }

  if (phase === 'pickup') {
    const location = timelineLocationLabel(item.rental?.pickupLocation);
    return [dateLabel, time, location].filter(Boolean).join(' · ');
  }

  if (phase === 'dropoff') {
    const location = timelineLocationLabel(
      item.rental?.dropoffLocation || item.rental?.pickupLocation,
    );
    return [dateLabel, time, location].filter(Boolean).join(' · ');
  }

  if (phase === 'checkin' || phase === 'checkout') {
    return [dateLabel, time, item.title].filter(Boolean).join(' · ');
  }

  if (phase === 'depart') {
    return [
      dateLabel,
      time,
      item.transport?.origin,
      item.transport ? transportModeLabel(item.transport.mode) : undefined,
    ].filter(Boolean).join(' · ');
  }

  if (phase === 'arrive') {
    return [dateLabel, time, item.transport?.destination].filter(Boolean).join(' · ');
  }

  if (phase === 'stop') {
    return [dateLabel, time, entry.stop?.address].filter(Boolean).join(' · ');
  }

  // Default: preserve full captions used in Flights / Rentals sections.
  if (item.kind === 'moment') {
    return `${dateLabel} · ${formatMinutes(item.startMinutes)}`;
  }
  if (item.kind === 'flight') {
    return formatFlightItineraryCaption(
      flightCaptionInput(item, dateDisplayFormat),
    );
  }
  if (item.kind === 'rental') {
    const pickup = `${formatDateKeyMedium(item.date)} · ${formatMinutes(item.startMinutes)}`;
    if (!item.rental?.dropoffDate && item.rental?.dropoffMinutes === undefined) {
      return pickup;
    }
    const dropoffDate = item.rental.dropoffDate
      ? formatDateKeyMedium(item.rental.dropoffDate)
      : undefined;
    const dropoffTime =
      item.rental.dropoffMinutes !== undefined
        ? formatMinutes(item.rental.dropoffMinutes)
        : undefined;
    const dropoff = [dropoffDate, dropoffTime].filter(Boolean).join(' · ');
    return dropoff ? `${pickup} → ${dropoff}` : pickup;
  }
  if (item.kind === 'stay') {
    const checkin = `${formatDateKeyMedium(item.date)} · ${formatMinutes(item.startMinutes)}`;
    if (!item.stay?.checkoutDate && item.stay?.checkoutMinutes === undefined) {
      return checkin;
    }
    const checkoutDate = item.stay.checkoutDate
      ? formatDateKeyMedium(item.stay.checkoutDate)
      : undefined;
    const checkoutTime =
      item.stay.checkoutMinutes !== undefined
        ? formatMinutes(item.stay.checkoutMinutes)
        : undefined;
    const checkout = [checkoutDate, checkoutTime].filter(Boolean).join(' · ');
    return checkout ? `${checkin} → ${checkout}` : checkin;
  }
  if (item.kind === 'transport' && item.transport) {
    return `${dateLabel} · ${time} · ${item.transport.origin} → ${item.transport.destination}`;
  }
  return `${dateLabel} · ${formatMinutes(item.startMinutes)} · ${item.durationMinutes} min`;
}
