import { useEffect, useMemo, useState } from 'react';

import { searchAddresses } from '@/features/travel/address-lookup';
import { canonicalTravelTripId } from '@/features/travel/trip-roster';
import type { TravelPlan } from '@/features/travel/types';

import type { TravelMapRenderedVisit } from './model';
import { travelMapSuggestionFingerprint } from './normalize';
import type {
  TravelDestinationLocation,
  TravelMapFriendLayer,
  TravelMapVisit,
} from './types';

export type TravelMapSuggestion = {
  plan: TravelPlan;
  location: TravelDestinationLocation;
  fingerprint: string;
};

export function useTravelMapSuggestion({
  plans,
  visits,
  dismissedFingerprints,
}: {
  plans: TravelPlan[];
  visits: TravelMapVisit[];
  dismissedFingerprints: string[];
}) {
  const [suggestion, setSuggestion] = useState<TravelMapSuggestion>();

  useEffect(() => {
    const represented = new Set(visits.flatMap((visit) => visit.tripId ? [visit.tripId] : []));
    const candidate = plans.find((plan) => {
      if (represented.has(plan.id)) return false;
      return !dismissedFingerprints.includes(
        travelMapSuggestionFingerprint(plan),
      );
    });
    if (!candidate) {
      setSuggestion(undefined);
      return;
    }
    const fingerprint = travelMapSuggestionFingerprint(candidate);
    if (candidate.destinationLocation) {
      setSuggestion({
        plan: candidate,
        location: candidate.destinationLocation,
        fingerprint,
      });
      return;
    }
    setSuggestion(undefined);
    let active = true;
    void searchAddresses(candidate.destination).then((results) => {
      const result = results.find(
        (entry) =>
          entry.countryCode &&
          entry.countryName &&
          entry.latitude != null &&
          entry.longitude != null,
      );
      if (
        !active ||
        !result?.countryCode ||
        !result.countryName ||
        result.latitude == null ||
        result.longitude == null
      ) {
        return;
      }
      setSuggestion({
        plan: candidate,
        fingerprint,
        location: {
          label: [result.label, result.secondary].filter(Boolean).join(', '),
          countryCode: result.countryCode,
          countryName: result.countryName,
          latitude: result.latitude,
          longitude: result.longitude,
        },
      });
    });
    return () => {
      active = false;
    };
  }, [dismissedFingerprints, plans, visits]);

  return { suggestion, setSuggestion };
}

export function useRenderedTravelMapVisits({
  plans,
  visits,
  friendLayers,
  self,
}: {
  plans: TravelPlan[];
  visits: TravelMapVisit[];
  friendLayers: TravelMapFriendLayer[];
  self: TravelMapRenderedVisit['person'];
}) {
  return useMemo<TravelMapRenderedVisit[]>(() => {
    const planIds = new Set(plans.map((plan) => plan.id));
    const canonicalPlanIds = new Set(plans.map(canonicalTravelTripId));
    const ownVisits = visits.map((visit) => ({
      visit,
      person: self,
      canOpenTrip: Boolean(visit.tripId && planIds.has(visit.tripId)),
    }));
    const sharedVisits = friendLayers.flatMap((layer) =>
      layer.visits.map((visit) => {
        const linkedTripId = visit.canonicalTripId ?? visit.tripId;
        return {
          visit,
          person: layer.person,
          canOpenTrip: Boolean(
            linkedTripId && canonicalPlanIds.has(linkedTripId),
          ),
        };
      }),
    );
    return [...ownVisits, ...sharedVisits];
  }, [friendLayers, plans, self, visits]);
}
