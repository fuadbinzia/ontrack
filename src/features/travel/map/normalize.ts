import { isDateKey } from '@/utils/date';

import { isSameTravelMapPlace } from './model';

import type {
  TravelMapPlacePin,
  TravelMapSettings,
  TravelMapTripSummary,
  TravelMapVisit,
} from './types';

const MAX_DISMISSED_SUGGESTIONS = 500;

function trimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const next = value.trim();
  return next || undefined;
}

function timestamp(value: unknown): string | undefined {
  const next = trimmed(value);
  return next && Number.isFinite(Date.parse(next)) ? next : undefined;
}

function coordinate(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

export function normalizeTravelMapTripSummary(
  value: unknown,
): TravelMapTripSummary | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const summary = value as Partial<TravelMapTripSummary>;
  const title = trimmed(summary.title);
  const destination = trimmed(summary.destination);
  if (
    !title ||
    !destination ||
    typeof summary.startDate !== 'string' ||
    typeof summary.endDate !== 'string' ||
    !isDateKey(summary.startDate) ||
    !isDateKey(summary.endDate)
  ) {
    return undefined;
  }
  return {
    title,
    destination,
    startDate: summary.startDate,
    endDate: summary.endDate,
  };
}

export function normalizeTravelMapPlacePin(
  value: unknown,
): TravelMapPlacePin | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const pin = value as Partial<TravelMapPlacePin>;
  const id = trimmed(pin.id);
  const label = trimmed(pin.label);
  const latitude = coordinate(pin.latitude, -90, 90);
  const longitude = coordinate(pin.longitude, -180, 180);
  const createdAt = timestamp(pin.createdAt);
  const updatedAt = timestamp(pin.updatedAt);
  if (!id || !label || latitude === undefined || longitude === undefined || !createdAt || !updatedAt) {
    return undefined;
  }
  return { id, label, latitude, longitude, createdAt, updatedAt };
}

export function normalizeTravelMapVisit(value: unknown): TravelMapVisit | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const visit = value as Partial<TravelMapVisit>;
  const id = trimmed(visit.id);
  const tripId = trimmed(visit.tripId);
  const canonicalTripId = trimmed(visit.canonicalTripId);
  const countryCode = trimmed(visit.countryCode)?.toUpperCase();
  const countryName = trimmed(visit.countryName);
  const tripSummary = normalizeTravelMapTripSummary(visit.tripSummary);
  const createdAt = timestamp(visit.createdAt);
  const updatedAt = timestamp(visit.updatedAt);
  if (
    !id ||
    !countryCode ||
    !/^[A-Z]{2}$/.test(countryCode) ||
    !countryName ||
    !createdAt ||
    !updatedAt ||
    Boolean(tripId) !== Boolean(tripSummary) ||
    Boolean(canonicalTripId) && !tripId
  ) {
    return undefined;
  }
  const normalizedPlaces = Array.isArray(visit.places)
    ? visit.places.flatMap((pin) => {
        const normalized = normalizeTravelMapPlacePin(pin);
        return normalized ? [normalized] : [];
      })
    : [];
  const places = normalizedPlaces.filter(
    (pin, index) =>
      normalizedPlaces.findIndex((entry) => isSameTravelMapPlace(entry, pin)) ===
      index,
  );
  return {
    id,
    ...(tripId ? { tripId } : {}),
    ...(canonicalTripId ? { canonicalTripId } : {}),
    countryCode,
    countryName,
    places,
    ...(tripSummary ? { tripSummary } : {}),
    createdAt,
    updatedAt,
  };
}

export function normalizeTravelMapVisits(value: unknown): TravelMapVisit[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, TravelMapVisit>();
  for (const entry of value) {
    const visit = normalizeTravelMapVisit(entry);
    if (!visit) continue;
    const current = byId.get(visit.id);
    if (!current || current.updatedAt <= visit.updatedAt) byId.set(visit.id, visit);
  }
  return [...byId.values()];
}

export const DEFAULT_TRAVEL_MAP_SETTINGS: TravelMapSettings = {
  shareWithFriends: false,
  selectedFriendIds: [],
  dismissedSuggestionFingerprints: [],
};

export function normalizeTravelMapSettings(value: unknown): TravelMapSettings {
  if (!value || typeof value !== 'object') return DEFAULT_TRAVEL_MAP_SETTINGS;
  const settings = value as Partial<TravelMapSettings>;
  return {
    shareWithFriends: settings.shareWithFriends === true,
    selectedFriendIds: Array.isArray(settings.selectedFriendIds)
      ? [...new Set(settings.selectedFriendIds.filter((id): id is string => Boolean(trimmed(id))))]
      : [],
    dismissedSuggestionFingerprints: Array.isArray(settings.dismissedSuggestionFingerprints)
      ? [...new Set(
          settings.dismissedSuggestionFingerprints.filter(
            (fingerprint): fingerprint is string => Boolean(trimmed(fingerprint)),
          ),
        )].slice(-MAX_DISMISSED_SUGGESTIONS)
      : [],
  };
}

export function travelMapSuggestionFingerprint(input: {
  id: string;
  destination: string;
  updatedAt: string;
}): string {
  return `${input.id}:${input.destination.trim().toLocaleLowerCase()}:${input.updatedAt}`;
}
