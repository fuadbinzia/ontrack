import { normalizeTravelItinerary } from '@/features/travel/normalize';
import type {
  TravelFlightDetails,
  TravelItemKind,
  TravelItineraryItem,
  TravelPlan,
  TravelRentalDetails,
  TravelTransportDetails,
} from '@/features/travel/types';

export const ONTRACK_APP_STORE_URL = 'https://apps.apple.com/app/id6789723522';
export const ONTRACK_TRAVEL_SHARE_URL = 'https://ontrack--links.expo.app';
const SHORT_INVITE_PREFIX = 's.';

const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function encodeBase64Url(value: string): string {
  const escaped = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < escaped.length; index += 1) {
    if (escaped[index] === '%') {
      bytes.push(Number.parseInt(escaped.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(escaped.charCodeAt(index));
    }
  }

  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += BASE64URL_ALPHABET[first >> 2];
    result += BASE64URL_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];
    if (second !== undefined) {
      result += BASE64URL_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)];
    }
    if (third !== undefined) result += BASE64URL_ALPHABET[third & 63];
  }
  return result;
}

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error('Invalid base64url value');
  }

  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64URL_ALPHABET.indexOf(value[index]);
    const second = BASE64URL_ALPHABET.indexOf(value[index + 1]);
    const third = value[index + 2] ? BASE64URL_ALPHABET.indexOf(value[index + 2]) : 0;
    const fourth = value[index + 3] ? BASE64URL_ALPHABET.indexOf(value[index + 3]) : 0;
    bytes.push((first << 2) | (second >> 4));
    if (value[index + 2]) bytes.push(((second & 15) << 4) | (third >> 2));
    if (value[index + 3]) bytes.push(((third & 3) << 6) | fourth);
  }

  return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
}

function compactFlightDetails(details?: TravelFlightDetails) {
  if (!details) return undefined;
  // Omit confirmation codes and seats from shareable invite payloads — those
  // are capability-bearing PII and must not live in base64url links.
  return [
    details.airline,
    details.flightNumber,
    details.departureAirport,
    details.arrivalAirport,
  ];
}

function compactRentalDetails(details?: TravelRentalDetails) {
  if (!details) return undefined;
  // Omit confirmation codes from invite payloads.
  return [
    details.company,
    details.pickupLocation,
    details.dropoffLocation,
    details.vehicleClass,
    details.dropoffDate,
    details.dropoffMinutes,
  ];
}

function compactTransportDetails(details?: TravelTransportDetails) {
  if (!details) return undefined;
  return [
    details.mode,
    details.operator,
    details.serviceNumber,
    details.origin,
    details.destination,
    details.arrivalDate,
    details.arrivalMinutes,
    details.vehicle,
    details.distance,
    details.distanceUnit,
    (details.stops ?? []).map((stop) => [
      stop.id,
      stop.name,
      stop.address,
      stop.arrivalDate,
      stop.arrivalMinutes,
      stop.notes,
    ]),
  ];
}

function compactItineraryItem(item: TravelItineraryItem) {
  const kind: Record<TravelItemKind, string> = {
    flight: 'f',
    transport: 't',
    stay: 's',
    activity: 'a',
    rental: 'r',
    moment: 'm',
    event: 'e',
  };
  return [
    item.id,
    kind[item.kind],
    item.title,
    item.date,
    item.startMinutes,
    item.durationMinutes,
    item.details,
    // bookingUrl omitted from encoded invites (open redirect / tracking risk)
    undefined,
    compactFlightDetails(item.flight),
    compactRentalDetails(item.rental),
    compactTransportDetails(item.transport),
  ];
}

export function encodeTravelInvite(plan: TravelPlan): string {
  // Bootstrap the full itinerary (booking secrets stripped in compact*).
  const compactPlan = [
    plan.title,
    plan.destination,
    plan.startDate,
    plan.endDate,
    plan.notes,
    plan.itinerary.map(compactItineraryItem),
    plan.mode ?? 'flight',
    plan.origin,
  ];
  return `3.${encodeBase64Url(JSON.stringify(compactPlan))}`;
}

function stringAt(value: unknown[], index: number): string | undefined {
  return typeof value[index] === 'string' ? value[index] : undefined;
}

function expandItineraryItem(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const kind = {
    f: 'flight',
    t: 'transport',
    s: 'stay',
    a: 'activity',
    r: 'rental',
    m: 'moment',
    e: 'event',
  }[stringAt(value, 1) ?? ''];
  const flightRaw = Array.isArray(value[8]) ? value[8] : undefined;
  // New encodes omit confirmation/seat (4 fields). Legacy encodes had 6.
  const flight = flightRaw
    ? flightRaw.length >= 6
      ? {
          airline: stringAt(flightRaw, 0),
          flightNumber: stringAt(flightRaw, 1),
          confirmationCode: stringAt(flightRaw, 2),
          departureAirport: stringAt(flightRaw, 3),
          arrivalAirport: stringAt(flightRaw, 4),
          seat: stringAt(flightRaw, 5),
        }
      : {
          airline: stringAt(flightRaw, 0),
          flightNumber: stringAt(flightRaw, 1),
          departureAirport: stringAt(flightRaw, 2),
          arrivalAirport: stringAt(flightRaw, 3),
        }
    : undefined;
  const rentalRaw = Array.isArray(value[9]) ? value[9] : undefined;
  const rental = rentalRaw
    ? {
        company: stringAt(rentalRaw, 0),
        pickupLocation: stringAt(rentalRaw, 1),
        dropoffLocation: stringAt(rentalRaw, 2),
        vehicleClass: stringAt(rentalRaw, 3),
        dropoffDate: stringAt(rentalRaw, 4),
        dropoffMinutes:
          typeof rentalRaw[5] === 'number' ? rentalRaw[5] : undefined,
      }
    : undefined;
  const transportRaw = Array.isArray(value[10]) ? value[10] : undefined;
  const transport = transportRaw
    ? {
        mode: stringAt(transportRaw, 0),
        operator: stringAt(transportRaw, 1),
        serviceNumber: stringAt(transportRaw, 2),
        origin: stringAt(transportRaw, 3),
        destination: stringAt(transportRaw, 4),
        arrivalDate: stringAt(transportRaw, 5),
        arrivalMinutes:
          typeof transportRaw[6] === 'number' ? transportRaw[6] : undefined,
        vehicle: stringAt(transportRaw, 7),
        distance: typeof transportRaw[8] === 'number' ? transportRaw[8] : undefined,
        distanceUnit: stringAt(transportRaw, 9),
        stops: Array.isArray(transportRaw[10])
          ? transportRaw[10].map((rawStop) =>
              Array.isArray(rawStop)
                ? {
                    id: stringAt(rawStop, 0),
                    name: stringAt(rawStop, 1),
                    address: stringAt(rawStop, 2),
                    arrivalDate: stringAt(rawStop, 3),
                    arrivalMinutes:
                      typeof rawStop[4] === 'number' ? rawStop[4] : undefined,
                    notes: stringAt(rawStop, 5),
                  }
                : rawStop,
            )
          : undefined,
      }
    : undefined;
  return {
    id: stringAt(value, 0),
    kind,
    title: stringAt(value, 2),
    date: stringAt(value, 3),
    startMinutes: value[4],
    durationMinutes: value[5],
    details: stringAt(value, 6),
    bookingUrl: stringAt(value, 7),
    flight,
    rental,
    transport,
  };
}

function decodeCompactTravelInvite(
  value: string,
): Omit<TravelPlan, 'id' | 'createdAt' | 'updatedAt'> | undefined {
  const version = value.startsWith('3.') ? 3 : value.startsWith('2.') ? 2 : 0;
  if (!version) return undefined;
  const compact = JSON.parse(decodeBase64Url(value.slice(2))) as unknown;
  if (!Array.isArray(compact)) return undefined;

  const title = stringAt(compact, 0);
  const destination = stringAt(compact, 1);
  const startDate = stringAt(compact, 2);
  const endDate = stringAt(compact, 3);
  if (!title || !destination || !startDate || !endDate) return undefined;

  return {
    title,
    destination,
    startDate,
    endDate,
    notes: stringAt(compact, 4),
    mode: version >= 3 ? stringAt(compact, 6) as TravelPlan['mode'] : 'flight',
    origin: version >= 3 ? stringAt(compact, 7) : undefined,
    itinerary: normalizeTravelItinerary(
      Array.isArray(compact[5]) ? compact[5].map(expandItineraryItem) : [],
    ),
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
  };
}

export function decodeTravelInvite(value: string): Omit<TravelPlan, 'id' | 'createdAt' | 'updatedAt'> | undefined {
  for (const candidate of [value, (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })()]) {
    try {
      const compact = decodeCompactTravelInvite(candidate);
      if (compact) return compact;

      // Keep version 1 links working after the compact link format ships.
      const parsed = JSON.parse(candidate) as {
        version?: number;
        plan?: Partial<TravelPlan>;
      };
      const plan = parsed.plan;
      if (
        parsed.version !== 1 ||
        !plan ||
        typeof plan.title !== 'string' ||
        typeof plan.destination !== 'string' ||
        typeof plan.startDate !== 'string' ||
        typeof plan.endDate !== 'string'
      ) {
        continue;
      }
      return {
        title: plan.title,
        destination: plan.destination,
        startDate: plan.startDate,
        endDate: plan.endDate,
        notes: typeof plan.notes === 'string' ? plan.notes : undefined,
        itinerary: normalizeTravelItinerary(plan.itinerary),
        participants: [],
        baseCurrency: 'USD',
        expenses: [],
      };
    } catch {
      // Try the other encoded/decoded representation.
    }
  }
  return undefined;
}

/** Stable local key prevents the same shared link from creating duplicate trips. */
export function travelInviteKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

type TravelPlanIdentity = Pick<
  TravelPlan,
  'title' | 'destination' | 'startDate' | 'endDate'
>;

function normalizeTravelIdentityText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function travelPlanIdentity(plan: TravelPlanIdentity): string {
  return JSON.stringify([
    normalizeTravelIdentityText(plan.title),
    normalizeTravelIdentityText(plan.destination),
    plan.startDate,
    plan.endDate,
  ]);
}

export function travelPlanIdentityKey(plan: TravelPlanIdentity): string {
  return travelInviteKey(travelPlanIdentity(plan));
}

export function findMatchingTravelPlan(
  plans: TravelPlan[],
  candidate: TravelPlanIdentity,
): TravelPlan | undefined {
  const identity = travelPlanIdentity(candidate);
  return plans.find((plan) => travelPlanIdentity(plan) === identity);
}

/** Local id for a short invite code so distinct trips never collapse on title/dates. */
export function travelInviteLocalId(inviteCode: string): string {
  return `trip-invite-${inviteCode}`;
}

export function isShortTravelInvite(value: string): boolean {
  return /^s\.[a-f0-9]{20}$/.test(value);
}

export function createTravelInviteUrl(code: string, configuredBase?: string): string {
  const path = `/i/${code}`;
  const normalizedBase = (configuredBase || ONTRACK_TRAVEL_SHARE_URL).replace(/\/$/, '');
  return `${normalizedBase}${path}`;
}

export function createInstalledTravelInviteUrl(invite?: string): string {
  if (!invite) return 'ontrack:///travel';
  if (isShortTravelInvite(invite)) {
    return `ontrack:///i/${invite.slice(SHORT_INVITE_PREFIX.length)}`;
  }
  return `ontrack:///invite/travel?invite=${encodeURIComponent(invite)}`;
}
