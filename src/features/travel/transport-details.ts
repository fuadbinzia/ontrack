import { normalizeConfirmationUris } from '@/features/travel/confirmation-attachments';
import {
  TRAVEL_TRANSPORT_MODE_VALUES,
  transportModeLabel,
} from '@/features/travel/travel-mode';
import type {
  TravelRouteStop,
  TravelTransportDetails,
  TravelTransportMode,
} from '@/features/travel/types';
import { isDateKey, minutesBetween } from '@/utils/date';
import { asPositiveNumber, asString } from '@/utils/parse';

export interface TravelRouteStopDraft {
  id: string;
  name: string;
  address: string;
  arrivalDate: string;
  arrivalMinutes: number | null;
  notes: string;
}

export interface TransportDetailsDraft {
  mode: TravelTransportMode;
  operator: string;
  serviceNumber: string;
  origin: string;
  destination: string;
  arrivalDate: string;
  arrivalMinutes: number | null;
  platform: string;
  seat: string;
  vehicle: string;
  confirmationCode: string;
  confirmationUris?: string[];
  distance: string;
  distanceUnit: 'mi' | 'km';
  fare: string;
  currency: string;
  stops: TravelRouteStopDraft[];
}

export function emptyTransportDetailsDraft(input?: {
  origin?: string;
  destination?: string;
  arrivalDate?: string;
  arrivalMinutes?: number;
  currency?: string;
  mode?: TravelTransportMode;
}): TransportDetailsDraft {
  return {
    mode: input?.mode ?? 'driving',
    operator: '',
    serviceNumber: '',
    origin: input?.origin ?? '',
    destination: input?.destination ?? '',
    arrivalDate: input?.arrivalDate ?? '',
    arrivalMinutes: input?.arrivalMinutes ?? null,
    platform: '',
    seat: '',
    vehicle: '',
    confirmationCode: '',
    distance: '',
    distanceUnit: 'mi',
    fare: '',
    currency: input?.currency ?? 'USD',
    stops: [],
  };
}

export function transportDetailsDraft(
  value?: TravelTransportDetails,
): TransportDetailsDraft {
  return {
    ...emptyTransportDetailsDraft(),
    mode: value?.mode ?? 'driving',
    operator: value?.operator ?? '',
    serviceNumber: value?.serviceNumber ?? '',
    origin: value?.origin ?? '',
    destination: value?.destination ?? '',
    arrivalDate: value?.arrivalDate ?? '',
    arrivalMinutes: value?.arrivalMinutes ?? null,
    platform: value?.platform ?? '',
    seat: value?.seat ?? '',
    vehicle: value?.vehicle ?? '',
    confirmationCode: value?.confirmationCode ?? '',
    ...(value?.confirmationUris?.length
      ? { confirmationUris: value.confirmationUris }
      : {}),
    distance: value?.distance !== undefined ? String(value.distance) : '',
    distanceUnit: value?.distanceUnit ?? 'mi',
    fare: value?.fare !== undefined ? String(value.fare) : '',
    currency: value?.currency ?? 'USD',
    stops: (value?.stops ?? []).map((stop) => ({
      id: stop.id,
      name: stop.name,
      address: stop.address ?? '',
      arrivalDate: stop.arrivalDate ?? '',
      arrivalMinutes: stop.arrivalMinutes ?? null,
      notes: stop.notes ?? '',
    })),
  };
}

function optionalText(value: unknown, uppercase = false): string | undefined {
  const text = asString(value)?.trim();
  if (!text) return undefined;
  return uppercase ? text.toUpperCase() : text;
}

function normalizeMinutes(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= 0 && rounded < 24 * 60 ? rounded : undefined;
}

function normalizeRouteStop(value: unknown): TravelRouteStop | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Partial<TravelRouteStop>;
  const name = optionalText(input.name);
  if (!name || typeof input.id !== 'string' || !input.id.trim()) return undefined;
  const arrivalDate = optionalText(input.arrivalDate);
  const arrivalMinutes = normalizeMinutes(input.arrivalMinutes);
  const hasCompleteSchedule = Boolean(
    arrivalDate && isDateKey(arrivalDate) && arrivalMinutes !== undefined,
  );
  return {
    id: input.id,
    name,
    address: optionalText(input.address),
    ...(hasCompleteSchedule
      ? { arrivalDate, arrivalMinutes }
      : {}),
    notes: optionalText(input.notes),
  };
}

export function normalizeTransportDetails(
  value: unknown,
): TravelTransportDetails | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Partial<TravelTransportDetails>;
  if (!TRAVEL_TRANSPORT_MODE_VALUES.has(input.mode as TravelTransportMode)) {
    return undefined;
  }
  const origin = optionalText(input.origin);
  const destination = optionalText(input.destination);
  const arrivalDate = optionalText(input.arrivalDate);
  const arrivalMinutes = normalizeMinutes(input.arrivalMinutes);
  if (
    !origin ||
    !destination ||
    !arrivalDate ||
    !isDateKey(arrivalDate) ||
    arrivalMinutes === undefined
  ) {
    return undefined;
  }
  const distance = asPositiveNumber(input.distance);
  const fare = asPositiveNumber(input.fare);
  const currency = optionalText(input.currency, true);
  const confirmationUris = normalizeConfirmationUris(input.confirmationUris);
  const stops = Array.isArray(input.stops)
    ? input.stops.flatMap((stop) => {
        const normalized = normalizeRouteStop(stop);
        return normalized ? [normalized] : [];
      })
    : [];
  return {
    mode: input.mode as TravelTransportMode,
    operator: optionalText(input.operator),
    serviceNumber: optionalText(input.serviceNumber, true),
    origin,
    destination,
    arrivalDate,
    arrivalMinutes,
    platform: optionalText(input.platform),
    seat: optionalText(input.seat),
    vehicle: optionalText(input.vehicle),
    confirmationCode: optionalText(input.confirmationCode, true),
    ...(confirmationUris ? { confirmationUris } : {}),
    ...(distance !== undefined
      ? { distance, distanceUnit: input.distanceUnit === 'km' ? 'km' : 'mi' }
      : {}),
    ...(fare !== undefined && currency && /^[A-Z]{3}$/.test(currency)
      ? { fare, currency }
      : {}),
    ...(stops.length ? { stops } : {}),
  };
}

export function validateTransportDetails(input: {
  draft: TransportDetailsDraft;
  departureDate: string;
  departureMinutes: number;
  planStartDate: string;
  planEndDate: string;
}):
  | { ok: true; value: TravelTransportDetails }
  | { ok: false; error: string } {
  const { draft } = input;
  if (!draft.origin.trim() || !draft.destination.trim()) {
    return { ok: false, error: 'Add both an origin and destination.' };
  }
  if (
    !isDateKey(draft.arrivalDate) ||
    draft.arrivalDate < input.planStartDate ||
    draft.arrivalDate > input.planEndDate ||
    draft.arrivalMinutes === null
  ) {
    return { ok: false, error: 'Choose an arrival date and time within this trip.' };
  }
  const duration = minutesBetween(
    input.departureDate,
    input.departureMinutes,
    draft.arrivalDate,
    draft.arrivalMinutes,
  );
  if (!Number.isFinite(duration) || duration <= 0) {
    return { ok: false, error: 'Arrival needs to be after departure.' };
  }
  if (draft.distance.trim()) {
    const distance = Number(draft.distance.replace(',', '.'));
    if (!Number.isFinite(distance) || distance < 0) {
      return { ok: false, error: 'Distance must be zero or greater.' };
    }
  }
  if (draft.fare.trim()) {
    const fare = Number(draft.fare.replace(',', '.'));
    if (!Number.isFinite(fare) || fare <= 0) {
      return { ok: false, error: 'Fare must be greater than zero.' };
    }
    if (!/^[A-Z]{3}$/.test(draft.currency.trim().toUpperCase())) {
      return { ok: false, error: 'Use a three-letter currency code.' };
    }
  }
  let previousStamp = 0;
  for (const stop of draft.stops) {
    if (!stop.name.trim()) return { ok: false, error: 'Give every route stop a name.' };
    const hasDate = Boolean(stop.arrivalDate);
    const hasTime = stop.arrivalMinutes !== null;
    if (hasDate !== hasTime) {
      return { ok: false, error: `Add both a date and time for ${stop.name.trim()}.` };
    }
    if (!hasDate || stop.arrivalMinutes === null) continue;
    const fromDeparture = minutesBetween(
      input.departureDate,
      input.departureMinutes,
      stop.arrivalDate,
      stop.arrivalMinutes,
    );
    if (fromDeparture <= 0 || fromDeparture >= duration || fromDeparture <= previousStamp) {
      return {
        ok: false,
        error: 'Timed stops must be ordered between departure and arrival.',
      };
    }
    previousStamp = fromDeparture;
  }
  const value = normalizeTransportDetails({
    ...draft,
    distance: draft.distance.trim()
      ? Number(draft.distance.replace(',', '.'))
      : undefined,
    fare: draft.fare.trim() ? Number(draft.fare.replace(',', '.')) : undefined,
    currency: draft.currency.trim().toUpperCase(),
    stops: draft.stops.map((stop) => ({
      ...stop,
      address: stop.address.trim() || undefined,
      arrivalDate: stop.arrivalDate || undefined,
      arrivalMinutes: stop.arrivalMinutes ?? undefined,
      notes: stop.notes.trim() || undefined,
    })),
  });
  if (!value) return { ok: false, error: 'Check the transport details and try again.' };
  return { ok: true, value };
}

export function defaultTransportTitle(details: TravelTransportDetails): string {
  return `${transportModeLabel(details.mode)} · ${details.origin} → ${details.destination}`;
}

export function transportDirectionsUrl(
  details: Pick<TravelTransportDetails, 'mode' | 'origin' | 'destination' | 'stops'>,
): string | undefined {
  if (details.mode !== 'driving' || !details.origin.trim() || !details.destination.trim()) {
    return undefined;
  }
  const params = new URLSearchParams({
    api: '1',
    origin: details.origin.trim(),
    destination: details.destination.trim(),
    travelmode: 'driving',
  });
  const waypoints = (details.stops ?? [])
    .map((stop) => stop.address?.trim() || stop.name.trim())
    .filter(Boolean);
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
