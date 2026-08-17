import { canonicalTravelTripId } from '@/features/travel/trip-roster';
import type { TravelPlan } from '@/features/travel/types';
import { newUuid } from '@/utils/id';

import type {
    TravelMapPerson,
    TravelMapPlacePin,
    TravelMapTripSummary,
    TravelMapVisit,
} from './types';

export const TRAVEL_MAP_SELF_COLOR = '#155EA8';
export const TRAVEL_MAP_FRIEND_COLORS = [
  '#DE5A3C',
  '#7B5CC7',
  '#168C75',
  '#D38A19',
  '#C14276',
  '#3478C9',
] as const;

const TRAVEL_MAP_PLACE_COORDINATE_EPSILON = 0.00001;

/** Treat repeat saves of the same map point as one place, even with a new pin id. */
export function isSameTravelMapPlace(
  left: Pick<TravelMapPlacePin, 'latitude' | 'longitude'>,
  right: Pick<TravelMapPlacePin, 'latitude' | 'longitude'>,
): boolean {
  return (
    Math.abs(left.latitude - right.latitude) <=
      TRAVEL_MAP_PLACE_COORDINATE_EPSILON &&
    Math.abs(left.longitude - right.longitude) <=
      TRAVEL_MAP_PLACE_COORDINATE_EPSILON
  );
}

export function travelMapPersonColor(index: number, isSelf = false): string {
  if (isSelf) return TRAVEL_MAP_SELF_COLOR;
  return TRAVEL_MAP_FRIEND_COLORS[Math.abs(index) % TRAVEL_MAP_FRIEND_COLORS.length]!;
}

/** A friend's pin color stays stable regardless of picker order or active layers. */
export function travelMapPersonColorForId(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) | 0;
  }
  return travelMapPersonColor(hash);
}

export function travelMapTripSummary(plan: TravelPlan): TravelMapTripSummary {
  return {
    title: plan.title,
    destination: plan.destination,
    startDate: plan.startDate,
    endDate: plan.endDate,
  };
}

export function createTravelMapVisit(input: {
  plan: TravelPlan;
  countryCode: string;
  countryName: string;
  place?: Omit<TravelMapPlacePin, 'id' | 'createdAt' | 'updatedAt'>;
  now?: string;
}): TravelMapVisit {
  const now = input.now ?? new Date().toISOString();
  const place = input.place
    ? [{ ...input.place, id: newUuid(), createdAt: now, updatedAt: now }]
    : [];
  return {
    id: newUuid(),
    tripId: input.plan.id,
    canonicalTripId: canonicalTravelTripId(input.plan),
    countryCode: input.countryCode.trim().toUpperCase(),
    countryName: input.countryName.trim(),
    places: place,
    tripSummary: travelMapTripSummary(input.plan),
    createdAt: now,
    updatedAt: now,
  };
}

export function createStandaloneTravelMapVisit(input: {
  countryCode: string;
  countryName: string;
  place?: Omit<TravelMapPlacePin, 'id' | 'createdAt' | 'updatedAt'>;
  now?: string;
}): TravelMapVisit {
  const now = input.now ?? new Date().toISOString();
  const place = input.place
    ? [{ ...input.place, id: newUuid(), createdAt: now, updatedAt: now }]
    : [];
  return {
    id: newUuid(),
    countryCode: input.countryCode.trim().toUpperCase(),
    countryName: input.countryName.trim(),
    places: place,
    createdAt: now,
    updatedAt: now,
  };
}

export function syncTravelMapVisitSummary(
  visit: TravelMapVisit,
  plan: TravelPlan,
): TravelMapVisit {
  if (!visit.tripId || !visit.tripSummary) return visit;
  const summary = travelMapTripSummary(plan);
  if (
    visit.tripSummary.title === summary.title &&
    visit.tripSummary.destination === summary.destination &&
    visit.tripSummary.startDate === summary.startDate &&
    visit.tripSummary.endDate === summary.endDate
  ) {
    return visit;
  }
  return { ...visit, tripSummary: summary, updatedAt: new Date().toISOString() };
}

export interface TravelMapRenderedVisit {
  visit: TravelMapVisit;
  person: TravelMapPerson;
  canOpenTrip: boolean;
}

export interface TravelMapPlaceSelection {
  rendered: TravelMapRenderedVisit;
  pin: TravelMapPlacePin;
}

export interface TravelMapCountryCluster {
  countryCode: string;
  countryName: string;
  colors: string[];
  visits: TravelMapRenderedVisit[];
}

export function travelMapCountryClusters(
  visits: readonly TravelMapRenderedVisit[],
): TravelMapCountryCluster[] {
  const clusters = new Map<string, TravelMapCountryCluster>();
  for (const rendered of visits) {
    const key = rendered.visit.countryCode;
    const current = clusters.get(key);
    if (current) {
      current.visits.push(rendered);
      if (!current.colors.includes(rendered.person.color)) {
        current.colors.push(rendered.person.color);
      }
    } else {
      clusters.set(key, {
        countryCode: key,
        countryName: rendered.visit.countryName,
        colors: [rendered.person.color],
        visits: [rendered],
      });
    }
  }
  return [...clusters.values()];
}
